import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { PostgrestError, RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { useAuth } from './auth'
import { lerCache, salvarCache } from './cache'
import type {
  Area, AreaInsert, ItemPauta, Membro, MembroInsert, Participante, Reuniao, Subtarefa, Tarefa, TarefaInsert,
} from '../types/database'

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------
export type NovaTarefa = Omit<TarefaInsert, 'id' | 'user_id'>
export type AlteracaoTarefa = Partial<NovaTarefa>
export type NovaArea = Omit<AreaInsert, 'id' | 'user_id'>
export type AlteracaoArea = Partial<NovaArea>
export type NovoMembro = Omit<MembroInsert, 'id' | 'user_id'>
export type AlteracaoMembro = Partial<NovoMembro>
export type NovaReuniao = Pick<Reuniao, 'titulo' | 'inicio'> & Partial<Pick<Reuniao, 'fim' | 'local' | 'area_id' | 'status' | 'ata'>>
export type AlteracaoReuniao = Partial<NovaReuniao>
export type AlteracaoSubtarefa = Partial<Pick<Subtarefa, 'titulo' | 'feita' | 'ordem'>>
export type AlteracaoItem = Partial<Pick<ItemPauta, 'texto' | 'discutido' | 'notas' | 'ordem'>>

/** Estado do canal Realtime: 'online' = recebendo alterações de outros dispositivos. */
export type Sincronia = 'conectando' | 'online' | 'offline'

/** Resultado de criação: id, ou mensagem de erro para exibir no formulário. */
export type Criado = { id: string } | { erro: string }

// ---------------------------------------------------------------------------
// Coleções
// ---------------------------------------------------------------------------
interface Colecoes {
  areas: Area[]
  tarefas: Tarefa[]
  membros: Membro[]
  subtarefas: Subtarefa[]
  reunioes: Reuniao[]
  reuniao_itens: ItemPauta[]
  reuniao_participantes: Participante[]
}
type Tabela = keyof Colecoes
type Linha<K extends Tabela> = Colecoes[K][number]

const porOrdem = (a: { ordem: number }, b: { ordem: number }) => a.ordem - b.ordem
const ORDENAR: { [K in Tabela]: ((a: Linha<K>, b: Linha<K>) => number) | null } = {
  areas: porOrdem,
  tarefas: null, // cada tela ordena do seu jeito
  membros: porOrdem,
  subtarefas: porOrdem,
  reunioes: (a, b) => a.inicio.localeCompare(b.inicio),
  reuniao_itens: porOrdem,
  reuniao_participantes: null,
}
const TABELAS = Object.keys(ORDENAR) as Tabela[]
const VAZIO: Colecoes = { areas: [], tarefas: [], membros: [], subtarefas: [], reunioes: [], reuniao_itens: [], reuniao_participantes: [] }

function ordenar<K extends Tabela>(t: K, xs: Colecoes[K]): Colecoes[K] {
  const f = ORDENAR[t] as ((a: Linha<K>, b: Linha<K>) => number) | null
  return (f ? [...xs].sort(f) : xs) as Colecoes[K]
}

/**
 * Efeitos de uma exclusão nas outras coleções — espelha as FKs do banco
 * (on delete cascade / set null), para a tela já refletir sem esperar o servidor.
 */
function semDependentes(d: Colecoes, t: Tabela, id: string): Colecoes {
  switch (t) {
    case 'areas':
      return {
        ...d,
        tarefas: d.tarefas.map((x) => (x.area_id === id ? { ...x, area_id: null } : x)),
        reunioes: d.reunioes.map((x) => (x.area_id === id ? { ...x, area_id: null } : x)),
      }
    case 'membros':
      return {
        ...d,
        tarefas: d.tarefas.map((x) => (x.responsavel_id === id ? { ...x, responsavel_id: null } : x)),
        reuniao_participantes: d.reuniao_participantes.filter((x) => x.membro_id !== id),
      }
    case 'tarefas':
      return { ...d, subtarefas: d.subtarefas.filter((x) => x.tarefa_id !== id) }
    case 'reunioes':
      return {
        ...d,
        reuniao_itens: d.reuniao_itens.filter((x) => x.reuniao_id !== id),
        reuniao_participantes: d.reuniao_participantes.filter((x) => x.reuniao_id !== id),
        tarefas: d.tarefas.map((x) => (x.reuniao_id === id ? { ...x, reuniao_id: null } : x)),
      }
    default:
      return d
  }
}

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------
/** randomUUID só existe em contexto seguro; o fallback cobre testes por IP na rede local. */
function novoId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6]! & 0x0f) | 0x40
  b[8] = (b[8]! & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

function semIndefinidos<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T
}

const DUPLICADO: Partial<Record<Tabela, string>> = {
  areas: 'Já existe uma operação com esse nome.',
  membros: 'Já existe um agente com esse nome.',
  reuniao_participantes: 'Este agente já está convocado.',
}
const INVALIDO: Partial<Record<Tabela, string>> = {
  areas: 'Dados inválidos: nome até 60 caracteres; código só com A–Z, 0–9 e hífen (até 12).',
  membros: 'Dados inválidos: nome até 60 caracteres, função até 40, telefone com 10 a 15 dígitos.',
  reunioes: 'Dados inválidos: título até 200 caracteres e o fim precisa ser depois do início.',
}
function mensagem(t: Tabela, e: Pick<PostgrestError, 'code' | 'message'>) {
  if (e.code === '23505') return DUPLICADO[t] ?? 'Registro duplicado.'
  if (e.code === '23514') return INVALIDO[t] ?? 'Dados inválidos.'
  if (/fetch|network/i.test(e.message)) return 'Sem conexão com a central. Verifique a internet.'
  return e.message
}

const SEM_REDE = 'Sem conexão: modo somente leitura.'

// Cliente sem tipagem por tabela: as operações genéricas abaixo cuidam dos tipos.
const db = supabase as unknown as SupabaseClient

// ---------------------------------------------------------------------------
// Contexto
// ---------------------------------------------------------------------------
interface DadosCtx {
  sincronia: Sincronia
  /** Sem acesso à central (sem internet ou banco inacessível): o app fica somente leitura. */
  semRede: boolean
  /** Momento do último retrato completo vindo do banco (ou do cache, se offline). */
  ultimaSincronia: Date | null
  carregando: boolean
  erro: string | null

  areas: Area[]
  areaPorId: Map<string, Area>
  criarArea: (nova: NovaArea) => Promise<Criado>
  atualizarArea: (id: string, alt: AlteracaoArea) => Promise<string | null>
  excluirArea: (id: string) => Promise<void>

  tarefas: Tarefa[]
  criarTarefa: (nova: NovaTarefa) => Promise<void>
  atualizarTarefa: (id: string, alt: AlteracaoTarefa) => Promise<void>
  excluirTarefa: (id: string) => Promise<void>

  subtarefas: Subtarefa[]
  criarSubtarefa: (tarefaId: string, titulo: string) => Promise<void>
  atualizarSubtarefa: (id: string, alt: AlteracaoSubtarefa) => Promise<void>
  excluirSubtarefa: (id: string) => Promise<void>

  membros: Membro[]
  membroPorId: Map<string, Membro>
  criarMembro: (novo: NovoMembro) => Promise<Criado>
  atualizarMembro: (id: string, alt: AlteracaoMembro) => Promise<string | null>
  excluirMembro: (id: string) => Promise<void>

  reunioes: Reuniao[]
  criarReuniao: (nova: NovaReuniao) => Promise<Criado>
  atualizarReuniao: (id: string, alt: AlteracaoReuniao) => Promise<string | null>
  excluirReuniao: (id: string) => Promise<void>

  itensPauta: ItemPauta[]
  criarItemPauta: (reuniaoId: string, texto: string) => Promise<void>
  atualizarItemPauta: (id: string, alt: AlteracaoItem) => Promise<void>
  excluirItemPauta: (id: string) => Promise<void>

  participantes: Participante[]
  convocar: (reuniaoId: string, membroId: string) => Promise<void>
  desconvocar: (participanteId: string) => Promise<void>
  marcarPresenca: (participanteId: string, presente: boolean | null) => Promise<void>
}

const Ctx = createContext<DadosCtx | null>(null)

export function DadosProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth()
  const userId = usuario?.id

  // O cache permite desenhar a tela na hora — e é o que aparece offline.
  const [cacheInicial] = useState(() => (userId ? lerCache<Colecoes>(userId) : null))
  const [dados, setDados] = useState<Colecoes>(() => ({ ...VAZIO, ...cacheInicial?.colecoes }))
  const [carregando, setCarregando] = useState(!cacheInicial)
  const [ultimaSincronia, setUltimaSincronia] = useState<Date | null>(cacheInicial ? new Date(cacheInicial.salvoEm) : null)
  const [erro, setErro] = useState<string | null>(null)
  const [falha, setFalha] = useState<string | null>(null)
  const [sincronia, setSincronia] = useState<Sincronia>('conectando')
  const [semRede, setSemRede] = useState(() => !navigator.onLine)
  const temDados = useRef(!!cacheInicial)

  // Cópia sempre atual, para desfazer alterações otimistas.
  const atual = useRef(dados)
  useEffect(() => {
    atual.current = dados
  }, [dados])

  const mudar = useCallback(<K extends Tabela>(t: K, f: (xs: Colecoes[K]) => Colecoes[K]) => {
    setDados((d) => ({ ...d, [t]: ordenar(t, f(d[t])) }))
  }, [])

  const avisar = useCallback((msg: string) => {
    setFalha(msg)
    window.setTimeout(() => setFalha((f) => (f === msg ? null : f)), 6000)
  }, [])

  // -------------------------------------------------------------------------
  // Carga completa
  // -------------------------------------------------------------------------
  /** Busca tudo do banco. Usado na abertura, ao reconectar e para corrigir uma falha. */
  const recarregar = useCallback(async () => {
    const respostas = await Promise.all(TABELAS.map((t) => db.from(t).select('*')))
    // Tabela inexistente (migração não aplicada): carrega o resto e avisa, sem derrubar o app.
    const faltando = TABELAS.filter((_, i) => respostas[i]!.error?.code === 'PGRST205')
    const e = respostas.find((r) => r.error && r.error.code !== 'PGRST205')?.error
    if (e) {
      const offline = !navigator.onLine || /fetch|network/i.test(e.message)
      if (offline) setSemRede(true)
      // Com cópia local, falta de rede não é erro: seguimos em modo leitura.
      if (!(offline && temDados.current)) setErro(offline ? 'Sem conexão e sem cópia local neste dispositivo.' : e.message)
    } else {
      const novo = { ...VAZIO }
      TABELAS.forEach((t, i) => {
        ;(novo as Record<Tabela, unknown>)[t] = ordenar(t, (respostas[i]!.data ?? []) as Colecoes[typeof t])
      })
      setDados(novo)
      setErro(
        faltando.length
          ? `Banco desatualizado — faltam as tabelas ${faltando.join(', ')}. Aplique as migrações com: npx supabase db push --remote`
          : null,
      )
      setSemRede(!navigator.onLine)
      setUltimaSincronia(new Date())
      temDados.current = true
    }
    setCarregando(false)
  }, [])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  // Mantém a cópia local em dia (agrupando mudanças rápidas).
  useEffect(() => {
    if (!userId || !temDados.current) return
    const id = window.setTimeout(() => salvarCache(userId, dados, ultimaSincronia ?? new Date()), 400)
    return () => window.clearTimeout(id)
  }, [userId, dados, ultimaSincronia])

  // -------------------------------------------------------------------------
  // Realtime: alterações feitas em outro dispositivo chegam aqui
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!userId) return
    let jaConectou = false
    const filtro = `user_id=eq.${userId}`
    let canal = supabase.channel(`vigilia:${userId}`)

    for (const t of TABELAS) {
      const upsert = (p: RealtimePostgresChangesPayload<{ id: string }>) => {
        const novo = p.new as Linha<typeof t>
        mudar(t, (xs) => {
          const lista = xs as Linha<typeof t>[]
          return (lista.some((x) => x.id === novo.id) ? lista.map((x) => (x.id === novo.id ? novo : x)) : [...lista, novo]) as Colecoes[typeof t]
        })
      }
      canal = canal
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: t, filter: filtro }, upsert)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: t, filter: filtro }, upsert)
        // DELETE não aceita filtro no Realtime; o evento traz só o id.
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: t }, (p: RealtimePostgresChangesPayload<{ id: string }>) => {
          const id = (p.old as { id?: string }).id
          if (!id) return
          setDados((d) => {
            const sem = { ...d, [t]: (d[t] as { id: string }[]).filter((x) => x.id !== id) } as Colecoes
            return semDependentes(sem, t, id)
          })
        })
    }

    canal.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        setSincronia('online')
        setSemRede(false)
        // Ao reconectar, busca o que mudou enquanto o canal estava fora.
        if (jaConectou) void recarregar()
        jaConectou = true
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        setSincronia('offline')
        if (err) console.warn('[Vigília] Realtime:', status, err.message)
      }
    })

    // Volta da aba depois de um tempo, ou volta da internet: ressincroniza.
    let escondidoEm = 0
    const aoMudarVisibilidade = () => {
      if (document.visibilityState === 'hidden') escondidoEm = Date.now()
      else if (escondidoEm && Date.now() - escondidoEm > 60_000) void recarregar()
    }
    const aoFicarOnline = () => void recarregar()
    const aoFicarOffline = () => {
      setSemRede(true)
      setSincronia('offline')
    }
    document.addEventListener('visibilitychange', aoMudarVisibilidade)
    window.addEventListener('online', aoFicarOnline)
    window.addEventListener('offline', aoFicarOffline)

    return () => {
      void supabase.removeChannel(canal)
      document.removeEventListener('visibilitychange', aoMudarVisibilidade)
      window.removeEventListener('online', aoFicarOnline)
      window.removeEventListener('offline', aoFicarOffline)
    }
  }, [userId, recarregar, mudar])

  // -------------------------------------------------------------------------
  // Operações genéricas (otimistas: a tela muda antes da resposta do banco)
  // -------------------------------------------------------------------------
  /** Insere; em erro, remove da tela e devolve a mensagem. */
  const inserir = useCallback(
    async <K extends Tabela>(t: K, otimista: Linha<K>, enviar: object): Promise<string | null> => {
      if (!navigator.onLine) return SEM_REDE
      mudar(t, (xs) => [...(xs as Linha<K>[]), otimista] as Colecoes[K])
      const { data, error } = await db.from(t).insert(enviar).select().single()
      if (error) {
        mudar(t, (xs) => (xs as Linha<K>[]).filter((x) => x.id !== otimista.id) as Colecoes[K])
        console.error(`[Vigília] inserir ${t}`, error)
        return mensagem(t, error)
      }
      mudar(t, (xs) => (xs as Linha<K>[]).map((x) => (x.id === otimista.id ? (data as Linha<K>) : x)) as Colecoes[K])
      return null
    },
    [mudar],
  )

  /** Altera; em erro, restaura o registro anterior e devolve a mensagem. */
  const alterar = useCallback(
    async <K extends Tabela>(t: K, id: string, alt: object, local: object = alt): Promise<string | null> => {
      if (!navigator.onLine) return SEM_REDE
      const anterior = (atual.current[t] as Linha<K>[]).find((x) => x.id === id)
      if (!anterior) return 'Registro não encontrado.'
      mudar(t, (xs) => (xs as Linha<K>[]).map((x) => (x.id === id ? { ...x, ...local } : x)) as Colecoes[K])
      const { data, error } = await db.from(t).update(alt).eq('id', id).select().single()
      if (error) {
        mudar(t, (xs) => (xs as Linha<K>[]).map((x) => (x.id === id ? anterior : x)) as Colecoes[K])
        console.error(`[Vigília] alterar ${t}`, error)
        return mensagem(t, error)
      }
      mudar(t, (xs) => (xs as Linha<K>[]).map((x) => (x.id === id ? (data as Linha<K>) : x)) as Colecoes[K])
      return null
    },
    [mudar],
  )

  /** Exclui (com efeitos nas coleções dependentes); em erro, recarrega do banco. */
  const remover = useCallback(
    async (t: Tabela, id: string): Promise<string | null> => {
      if (!navigator.onLine) return SEM_REDE
      setDados((d) => semDependentes({ ...d, [t]: (d[t] as { id: string }[]).filter((x) => x.id !== id) } as Colecoes, t, id))
      const { error } = await db.from(t).delete().eq('id', id)
      if (error) {
        console.error(`[Vigília] remover ${t}`, error)
        void recarregar()
        return mensagem(t, error)
      }
      return null
    },
    [recarregar],
  )

  /** Para operações sem formulário: mostra o erro no aviso flutuante. */
  const ou = useCallback(
    (prefixo: string) => (msg: string | null) => {
      if (msg) avisar(msg === SEM_REDE ? `${SEM_REDE} A alteração não foi feita.` : `${prefixo}: ${msg}`)
    },
    [avisar],
  )

  const carimbo = () => {
    const agora = new Date().toISOString()
    return { user_id: userId ?? '', created_at: agora, updated_at: agora }
  }
  const proximaOrdem = (xs: { ordem: number }[]) => Math.max(0, ...xs.map((x) => x.ordem)) + 1

  // -------------------------------------------------------------------------
  // Tarefas
  // -------------------------------------------------------------------------
  const criarTarefa = useCallback(
    async (nova: NovaTarefa) => {
      const id = novoId()
      const enviar = semIndefinidos({ ...nova, ordem: nova.ordem ?? -Date.now(), id })
      const otimista: Tarefa = {
        numero: 0, area_id: null, responsavel_id: null, reuniao_id: null, descricao: null, tipo: 'tarefa',
        status: 'a_fazer', prioridade: 'normal', prazo: null, prazo_dia_inteiro: false, concluida_em: null,
        ...carimbo(), ...enviar, ordem: enviar.ordem!,
      }
      ou(`Não foi possível registrar "${nova.titulo}"`)(await inserir('tarefas', otimista, enviar))
    },
    [inserir, ou, userId],
  )

  const atualizarTarefa = useCallback(
    async (id: string, alt: AlteracaoTarefa) => {
      const anterior = atual.current.tarefas.find((t) => t.id === id)
      const local: Partial<Tarefa> = { ...alt }
      if (anterior && alt.status && alt.status !== anterior.status) {
        local.concluida_em = alt.status === 'feito' ? new Date().toISOString() : null
      }
      ou('Alteração não salva')(await alterar('tarefas', id, alt, local))
    },
    [alterar, ou],
  )

  const excluirTarefa = useCallback(async (id: string) => ou('Exclusão falhou')(await remover('tarefas', id)), [remover, ou])

  // -------------------------------------------------------------------------
  // Subtarefas
  // -------------------------------------------------------------------------
  const criarSubtarefa = useCallback(
    async (tarefaId: string, titulo: string) => {
      const id = novoId()
      const irmas = atual.current.subtarefas.filter((s) => s.tarefa_id === tarefaId)
      const enviar = { id, tarefa_id: tarefaId, titulo: titulo.trim(), ordem: proximaOrdem(irmas) }
      ou('Subtarefa não criada')(await inserir('subtarefas', { ...carimbo(), feita: false, ...enviar }, enviar))
    },
    [inserir, ou, userId],
  )
  const atualizarSubtarefa = useCallback(
    async (id: string, alt: AlteracaoSubtarefa) => ou('Subtarefa não salva')(await alterar('subtarefas', id, alt)),
    [alterar, ou],
  )
  const excluirSubtarefa = useCallback(async (id: string) => ou('Exclusão falhou')(await remover('subtarefas', id)), [remover, ou])

  // -------------------------------------------------------------------------
  // Áreas (operações) e membros (agentes) — com retorno para formulários
  // -------------------------------------------------------------------------
  const criarArea = useCallback(
    async (nova: NovaArea): Promise<Criado> => {
      const id = novoId()
      const enviar = semIndefinidos({ ...nova, ordem: nova.ordem ?? proximaOrdem(atual.current.areas), id })
      const otimista: Area = { codigo: null, cor: null, arquivada: false, ...carimbo(), ...enviar, ordem: enviar.ordem! }
      const erroMsg = await inserir('areas', otimista, enviar)
      return erroMsg ? { erro: erroMsg } : { id }
    },
    [inserir, userId],
  )
  const atualizarArea = useCallback((id: string, alt: AlteracaoArea) => alterar('areas', id, alt), [alterar])
  const excluirArea = useCallback(async (id: string) => ou('Exclusão falhou')(await remover('areas', id)), [remover, ou])

  const criarMembro = useCallback(
    async (novo: NovoMembro): Promise<Criado> => {
      const id = novoId()
      const enviar = semIndefinidos({ ...novo, ordem: novo.ordem ?? proximaOrdem(atual.current.membros), id })
      const otimista: Membro = { funcao: null, telefone: null, ativo: true, ...carimbo(), ...enviar, ordem: enviar.ordem! }
      const erroMsg = await inserir('membros', otimista, enviar)
      return erroMsg ? { erro: erroMsg } : { id }
    },
    [inserir, userId],
  )
  const atualizarMembro = useCallback((id: string, alt: AlteracaoMembro) => alterar('membros', id, alt), [alterar])
  const excluirMembro = useCallback(async (id: string) => ou('Exclusão falhou')(await remover('membros', id)), [remover, ou])

  // -------------------------------------------------------------------------
  // Reuniões, pauta e convocados
  // -------------------------------------------------------------------------
  const criarReuniao = useCallback(
    async (nova: NovaReuniao): Promise<Criado> => {
      const id = novoId()
      const enviar = semIndefinidos({ ...nova, id })
      const otimista: Reuniao = { fim: null, local: null, area_id: null, status: 'agendada', ata: null, ...carimbo(), ...enviar }
      const erroMsg = await inserir('reunioes', otimista, enviar)
      return erroMsg ? { erro: erroMsg } : { id }
    },
    [inserir, userId],
  )
  const atualizarReuniao = useCallback((id: string, alt: AlteracaoReuniao) => alterar('reunioes', id, alt), [alterar])
  const excluirReuniao = useCallback(async (id: string) => ou('Exclusão falhou')(await remover('reunioes', id)), [remover, ou])

  const criarItemPauta = useCallback(
    async (reuniaoId: string, texto: string) => {
      const id = novoId()
      const irmaos = atual.current.reuniao_itens.filter((i) => i.reuniao_id === reuniaoId)
      const enviar = { id, reuniao_id: reuniaoId, texto: texto.trim(), ordem: proximaOrdem(irmaos) }
      ou('Item não criado')(await inserir('reuniao_itens', { ...carimbo(), discutido: false, notas: null, ...enviar }, enviar))
    },
    [inserir, ou, userId],
  )
  const atualizarItemPauta = useCallback(
    async (id: string, alt: AlteracaoItem) => ou('Item não salvo')(await alterar('reuniao_itens', id, alt)),
    [alterar, ou],
  )
  const excluirItemPauta = useCallback(async (id: string) => ou('Exclusão falhou')(await remover('reuniao_itens', id)), [remover, ou])

  const convocar = useCallback(
    async (reuniaoId: string, membroId: string) => {
      const id = novoId()
      const enviar = { id, reuniao_id: reuniaoId, membro_id: membroId }
      ou('Convocação falhou')(await inserir('reuniao_participantes', { ...carimbo(), presente: null, ...enviar }, enviar))
    },
    [inserir, ou, userId],
  )
  const desconvocar = useCallback(async (id: string) => ou('Falha ao remover')(await remover('reuniao_participantes', id)), [remover, ou])
  const marcarPresenca = useCallback(
    async (id: string, presente: boolean | null) => ou('Presença não salva')(await alterar('reuniao_participantes', id, { presente })),
    [alterar, ou],
  )

  // -------------------------------------------------------------------------
  const valor = useMemo<DadosCtx>(
    () => ({
      sincronia, semRede, ultimaSincronia, carregando, erro,
      areas: dados.areas, areaPorId: new Map(dados.areas.map((a) => [a.id, a])), criarArea, atualizarArea, excluirArea,
      tarefas: dados.tarefas, criarTarefa, atualizarTarefa, excluirTarefa,
      subtarefas: dados.subtarefas, criarSubtarefa, atualizarSubtarefa, excluirSubtarefa,
      membros: dados.membros, membroPorId: new Map(dados.membros.map((m) => [m.id, m])), criarMembro, atualizarMembro, excluirMembro,
      reunioes: dados.reunioes, criarReuniao, atualizarReuniao, excluirReuniao,
      itensPauta: dados.reuniao_itens, criarItemPauta, atualizarItemPauta, excluirItemPauta,
      participantes: dados.reuniao_participantes, convocar, desconvocar, marcarPresenca,
    }),
    [
      sincronia, semRede, ultimaSincronia, carregando, erro, dados,
      criarArea, atualizarArea, excluirArea, criarTarefa, atualizarTarefa, excluirTarefa,
      criarSubtarefa, atualizarSubtarefa, excluirSubtarefa, criarMembro, atualizarMembro, excluirMembro,
      criarReuniao, atualizarReuniao, excluirReuniao, criarItemPauta, atualizarItemPauta, excluirItemPauta,
      convocar, desconvocar, marcarPresenca,
    ],
  )

  return (
    <Ctx.Provider value={valor}>
      {children}
      {falha && (
        <div role="alert" className="aviso-falha">
          <span className="mono" style={{ color: 'var(--danger-text)' }}>FALHA NA TRANSMISSÃO</span>
          <span>{falha}</span>
        </div>
      )}
    </Ctx.Provider>
  )
}

export function useDados() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useDados precisa estar dentro de <DadosProvider>')
  return ctx
}
