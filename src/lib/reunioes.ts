import type { Area, ItemPauta, Membro, Participante, Reuniao, Tarefa } from '../types/database'
import { diasEntre, formatarPrazo } from './prazo'

const dd = (n: number) => String(n).padStart(2, '0')
const SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
const SEMANA_LONGA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const HORA = 3600_000

export const hora = (iso: string) => {
  const d = new Date(iso)
  return `${dd(d.getHours())}:${dd(d.getMinutes())}`
}

/** "19:00–20:00" ou "19:00". */
export const horario = (r: Pick<Reuniao, 'inicio' | 'fim'>) => (r.fim ? `${hora(r.inicio)}–${hora(r.fim)}` : hora(r.inicio))

/** "HOJE", "AMANHÃ", "QUA 18/11"… */
export function diaCurto(iso: string, agora = new Date()) {
  const d = new Date(iso)
  const n = diasEntre(agora, d)
  if (n === 0) return 'HOJE'
  if (n === 1) return 'AMANHÃ'
  if (n === -1) return 'ONTEM'
  return `${SEMANA[d.getDay()]} ${dd(d.getDate())}/${dd(d.getMonth() + 1)}`
}

export const fimEstimado = (r: Pick<Reuniao, 'inicio' | 'fim'>) => (r.fim ? new Date(r.fim) : new Date(new Date(r.inicio).getTime() + HORA))

export type SituacaoReuniao = 'cancelada' | 'realizada' | 'em_andamento' | 'hoje' | 'agendada' | 'aguardando_ata'

export function situacaoReuniao(r: Reuniao, agora = new Date()): SituacaoReuniao {
  if (r.status === 'cancelada') return 'cancelada'
  if (r.status === 'realizada') return 'realizada'
  const ini = new Date(r.inicio)
  if (agora >= ini && agora < fimEstimado(r)) return 'em_andamento'
  if (agora >= fimEstimado(r)) return 'aguardando_ata' // passou e ninguém marcou como realizada
  return diasEntre(agora, ini) === 0 ? 'hoje' : 'agendada'
}

export const ROTULO_SITUACAO: Record<SituacaoReuniao, string> = {
  cancelada: 'CANCELADA',
  realizada: 'REALIZADA',
  em_andamento: 'EM ANDAMENTO',
  hoje: 'HOJE',
  agendada: 'AGENDADA',
  aguardando_ata: 'AGUARDANDO ATA',
}

/** Reunião "por vir": agendada e ainda não terminou. */
export const porVir = (r: Reuniao, agora = new Date()) => r.status === 'agendada' && fimEstimado(r) > agora

const ehLink = (s: string | null) => !!s && /^https?:\/\//i.test(s.trim())
export { ehLink }

function dataLonga(iso: string) {
  const d = new Date(iso)
  return `${SEMANA_LONGA[d.getDay()]}, ${dd(d.getDate())}/${dd(d.getMonth() + 1)}`
}

interface Contexto {
  reuniao: Reuniao
  itens: ItemPauta[]
  participantes: Participante[]
  membroPorId: Map<string, Membro>
  area?: Area
  encaminhamentos?: Tarefa[]
}

const nomes = (ps: Participante[], m: Map<string, Membro>) =>
  ps.map((p) => m.get(p.membro_id)?.nome).filter(Boolean).join(', ')

/** Texto de convocação para o grupo (vai para pessoas reais: tom normal). */
export function mensagemConvocacao({ reuniao: r, itens, participantes, membroPorId }: Contexto) {
  return [
    `📌 *${r.titulo}*`,
    `🗓 ${dataLonga(r.inicio)} · ${horario(r)}`,
    r.local ? `📍 ${r.local}` : null,
    itens.length ? ['', '*Pauta*', ...itens.map((i, n) => `${n + 1}. ${i.texto}`)].join('\n') : null,
    participantes.length ? `\nConvocados: ${nomes(participantes, membroPorId)}` : null,
  ]
    .filter((x) => x !== null)
    .join('\n')
}

/** Ata resumida para compartilhar depois da reunião. */
export function mensagemAta({ reuniao: r, itens, participantes, membroPorId, encaminhamentos = [] }: Contexto) {
  const presentes = participantes.filter((p) => p.presente === true)
  const ausentes = participantes.filter((p) => p.presente === false)
  const linhas: (string | null)[] = [
    `📝 *Ata — ${r.titulo}*`,
    `${dataLonga(r.inicio)} · ${horario(r)}`,
    presentes.length ? `Presentes: ${nomes(presentes, membroPorId)}` : null,
    ausentes.length ? `Ausentes: ${nomes(ausentes, membroPorId)}` : null,
  ]
  if (itens.length) {
    linhas.push('', '*Pauta*')
    itens.forEach((i, n) => {
      linhas.push(`${i.discutido ? '✔' : '✖'} ${n + 1}. ${i.texto}${i.discutido ? '' : ' (não discutido)'}`)
      if (i.notas?.trim()) linhas.push(...i.notas.trim().split('\n').map((l) => `   ${l}`))
    })
  }
  if (encaminhamentos.length) {
    linhas.push('', '*Encaminhamentos*')
    for (const t of encaminhamentos) {
      const resp = t.responsavel_id ? membroPorId.get(t.responsavel_id)?.nome : null
      const prazo = t.prazo ? `até ${formatarPrazo(t.prazo, t.prazo_dia_inteiro).toLowerCase()}` : null
      linhas.push(`• ${[t.titulo, resp, prazo].filter(Boolean).join(' — ')}`)
    }
  }
  if (r.ata?.trim()) linhas.push('', '*Observações*', r.ata.trim())
  return linhas.filter((x) => x !== null).join('\n')
}
