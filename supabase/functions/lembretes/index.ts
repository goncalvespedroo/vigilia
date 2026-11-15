// Vigília · Edge Function "lembretes"
//
// Dois modos:
//  1. Ciclo agendado (pg_cron, a cada 5 min) — header x-vigilia-cron com o segredo.
//     Decide quais lembretes estão "no horário", registra em `lembretes` (deduplicação
//     atômica) e envia Web Push para os dispositivos do usuário.
//  2. Teste (chamado pelo app, com o JWT do usuário) — envia uma notificação de teste.
//
// Deploy: npx supabase functions deploy lembretes --no-verify-jwt --use-api
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VIGILIA_CRON_SECRET (opcional: VAPID_SUBJECT)

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('VIGILIA_CRON_SECRET') ?? ''
// O "subject" VAPID é um contato para o serviço de push; usamos a URL do projeto
// para não expor dados pessoais. Pode ser trocado pelo secret VAPID_SUBJECT.
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? SUPABASE_URL

webpush.setVapidDetails(VAPID_SUBJECT, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!)

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (dados: unknown, status = 200) =>
  new Response(JSON.stringify(dados), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
interface Inscricao {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  fuso: string
}
interface TarefaLembrete {
  id: string
  user_id: string
  titulo: string
  tipo: string
  prazo: string
  prazo_dia_inteiro: boolean
  area_id: string | null
}
type TipoLembrete = '1h' | 'dia' | 'vespera' | 'resumo'
interface Mensagem {
  titulo: string
  corpo: string
  url: string
  tag: string
}
interface Candidato {
  tipo: TipoLembrete
  tarefa_id: string | null
  referencia: string
  mensagem: Mensagem
}

// ---------------------------------------------------------------------------
// Fuso horário: datas "locais" do usuário a partir de instantes UTC e vice-versa
// ---------------------------------------------------------------------------
function partes(d: Date, fuso: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(d).map((x) => [x.type, x.value]),
  )
  return { ano: +p.year, mes: +p.month, dia: +p.day, hora: +p.hour, min: +p.minute, seg: +p.second }
}

/** Data local (AAAA-MM-DD) de um instante no fuso. */
function dataLocal(d: Date, fuso: string) {
  const p = partes(d, fuso)
  return `${p.ano}-${String(p.mes).padStart(2, '0')}-${String(p.dia).padStart(2, '0')}`
}

/** Instante UTC correspondente a "data local + hora:min" no fuso. */
function instante(data: string, hora: number, min: number, fuso: string): Date {
  const [a, m, d] = data.split('-').map(Number)
  const alvo = Date.UTC(a, m - 1, d, hora, min)
  let t = alvo
  for (let i = 0; i < 2; i++) {
    const p = partes(new Date(t), fuso)
    const visto = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.min)
    t += alvo - visto
  }
  return new Date(t)
}

function somarDiasData(data: string, n: number) {
  const [a, m, d] = data.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10)
}

const horaLocal = (d: Date, fuso: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, hour: '2-digit', minute: '2-digit' }).format(d)

const H = 3600_000

// ---------------------------------------------------------------------------
// Regras de lembrete
// ---------------------------------------------------------------------------
function candidatosDoUsuario(
  agora: Date,
  fuso: string,
  tarefas: TarefaLembrete[],
  nomeArea: (id: string | null) => string,
): Candidato[] {
  const saida: Candidato[] = []
  const hoje = dataLocal(agora, fuso)

  for (const t of tarefas) {
    const prazo = new Date(t.prazo)
    if (prazo <= agora) continue
    const area = nomeArea(t.area_id)
    const sufixo = (extra?: string) => [area, extra].filter(Boolean).join(' · ')

    if (!t.prazo_dia_inteiro) {
      // 1h antes do horário
      if (agora >= new Date(prazo.getTime() - H)) {
        saida.push({
          tipo: '1h', tarefa_id: t.id, referencia: t.prazo,
          mensagem: { titulo: 'Prazo em 1 hora', corpo: `${t.titulo}\n${sufixo(horaLocal(prazo, fuso))}`, url: '/hoje', tag: `${t.id}-1h` },
        })
      }
    } else {
      // 8h do dia do prazo (janela de 4h: tarefa criada à tarde não dispara aviso imediato)
      const gatilho = instante(dataLocal(prazo, fuso), 8, 0, fuso)
      if (agora >= gatilho && agora.getTime() < gatilho.getTime() + 4 * H) {
        saida.push({
          tipo: 'dia', tarefa_id: t.id, referencia: t.prazo,
          mensagem: { titulo: 'Vence hoje', corpo: `${t.titulo}${area ? `\n${area}` : ''}`, url: '/hoje', tag: `${t.id}-dia` },
        })
      }
    }

    // Provas e entregas: 20h da véspera (janela de 4h para não avisar fora de hora)
    if (t.tipo === 'prova' || t.tipo === 'entrega') {
      const gatilho = instante(somarDiasData(dataLocal(prazo, fuso), -1), 20, 0, fuso)
      if (agora >= gatilho && agora.getTime() < gatilho.getTime() + 4 * H) {
        const rotulo = t.tipo === 'prova' ? 'Prova amanhã' : 'Entrega amanhã'
        saida.push({
          tipo: 'vespera', tarefa_id: t.id, referencia: t.prazo,
          mensagem: {
            titulo: rotulo,
            corpo: `${t.titulo}\n${sufixo(t.prazo_dia_inteiro ? undefined : horaLocal(prazo, fuso))}`,
            url: '/hoje', tag: `${t.id}-vespera`,
          },
        })
      }
    }
  }

  // Resumo diário às 7h30 (janela até 11h30)
  const gatilhoResumo = instante(hoje, 7, 30, fuso)
  if (agora >= gatilhoResumo && agora.getTime() < gatilhoResumo.getTime() + 4 * H) {
    const deHoje = tarefas.filter((t) => new Date(t.prazo) > agora && dataLocal(new Date(t.prazo), fuso) === hoje)
    const atrasadas = tarefas.filter((t) => new Date(t.prazo) <= agora)
    if (deHoje.length || atrasadas.length) {
      const partesTexto = [
        deHoje.length && `${deHoje.length} ${deHoje.length === 1 ? 'vence' : 'vencem'} hoje`,
        atrasadas.length && `${atrasadas.length} ${atrasadas.length === 1 ? 'atrasada' : 'atrasadas'}`,
      ].filter(Boolean)
      const lista = [...atrasadas, ...deHoje].slice(0, 3).map((t) => `• ${t.titulo}`)
      saida.push({
        tipo: 'resumo', tarefa_id: null, referencia: hoje,
        mensagem: { titulo: 'Diretrizes de hoje', corpo: [partesTexto.join(' · '), ...lista].join('\n'), url: '/hoje', tag: `resumo-${hoje}` },
      })
    }
  }
  return saida
}

// ---------------------------------------------------------------------------
// Envio
// ---------------------------------------------------------------------------
/** Envia para todas as inscrições; remove as que o serviço de push declarou mortas. */
async function enviar(inscricoes: Inscricao[], m: Mensagem) {
  let ok = 0
  const mortas: string[] = []
  await Promise.all(
    inscricoes.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(m),
          { TTL: 6 * 3600, urgency: 'high' },
        )
        ok++
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) mortas.push(s.id)
        else console.error('push falhou', status, (e as Error).message)
      }
    }),
  )
  if (mortas.length) await admin.from('push_subscriptions').delete().in('id', mortas)
  return { ok, removidas: mortas.length }
}

async function ciclo(agora: Date) {
  const { data: subs, error: e1 } = await admin.from('push_subscriptions').select('id,user_id,endpoint,p256dh,auth,fuso')
  if (e1) throw e1
  if (!subs?.length) return { usuarios: 0, enviados: 0 }

  const porUsuario = new Map<string, Inscricao[]>()
  for (const s of subs as Inscricao[]) porUsuario.set(s.user_id, [...(porUsuario.get(s.user_id) ?? []), s])
  const usuarios = [...porUsuario.keys()]

  // Pendentes com prazo até depois de amanhã (inclui atrasadas, para o resumo)
  const [{ data: tarefas, error: e2 }, { data: areas, error: e3 }] = await Promise.all([
    admin
      .from('tarefas')
      .select('id,user_id,titulo,tipo,prazo,prazo_dia_inteiro,area_id')
      .in('user_id', usuarios)
      .neq('status', 'feito')
      .not('prazo', 'is', null)
      .lt('prazo', new Date(agora.getTime() + 50 * H).toISOString()),
    admin.from('areas').select('id,nome').in('user_id', usuarios),
  ])
  if (e2) throw e2
  if (e3) throw e3
  const nomes = new Map((areas ?? []).map((a) => [a.id as string, (a.nome as string).toUpperCase()]))

  let enviados = 0
  for (const [userId, inscricoes] of porUsuario) {
    const fuso = inscricoes[0]!.fuso || 'America/Sao_Paulo'
    const candidatos = candidatosDoUsuario(
      agora, fuso,
      ((tarefas ?? []) as TarefaLembrete[]).filter((t) => t.user_id === userId),
      (id) => (id ? nomes.get(id) ?? '' : ''),
    )
    if (!candidatos.length) continue

    // Deduplicação atômica: só envia o que foi inserido agora.
    const { data: novos, error } = await admin
      .from('lembretes')
      .upsert(
        candidatos.map((c) => ({ user_id: userId, tarefa_id: c.tarefa_id, tipo: c.tipo, referencia: c.referencia })),
        { onConflict: 'user_id,tarefa_id,tipo,referencia', ignoreDuplicates: true },
      )
      .select('tarefa_id,tipo,referencia')
    if (error) throw error

    for (const n of novos ?? []) {
      const c = candidatos.find((x) => x.tarefa_id === n.tarefa_id && x.tipo === n.tipo && x.referencia === n.referencia)
      if (!c) continue
      const r = await enviar(inscricoes, c.mensagem)
      enviados += r.ok
    }
  }
  return { usuarios: usuarios.length, enviados }
}

// ---------------------------------------------------------------------------
// Servidor
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ erro: 'método não permitido' }, 405)

  try {
    // 1) Ciclo agendado
    const segredo = req.headers.get('x-vigilia-cron')
    if (segredo !== null) {
      if (!CRON_SECRET || segredo !== CRON_SECRET) return json({ erro: 'segredo inválido' }, 401)
      return json(await ciclo(new Date()))
    }

    // 2) Teste pedido pelo app (JWT do usuário)
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return json({ erro: 'não autenticado' }, 401)
    const { data: u, error } = await admin.auth.getUser(token)
    if (error || !u.user) return json({ erro: 'sessão inválida' }, 401)

    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('id,user_id,endpoint,p256dh,auth,fuso')
      .eq('user_id', u.user.id)
    if (!subs?.length) return json({ erro: 'nenhum dispositivo inscrito' }, 404)

    const r = await enviar(subs as Inscricao[], {
      titulo: 'Canal de alertas operacional',
      corpo: 'Teste recebido. Você será avisado sobre prazos neste dispositivo.',
      url: '/',
      tag: 'teste',
    })
    return json({ dispositivos: subs.length, ...r })
  } catch (e) {
    console.error(e)
    return json({ erro: (e as Error).message }, 500)
  }
})
