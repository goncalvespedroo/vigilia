// Tipos escritos à mão a partir de supabase/migrations/20261114120000_areas_tarefas.sql.
// Depois do projeto linkado, dá para gerar automaticamente:
//   npx supabase gen types typescript --linked > src/types/database.ts

export type TarefaTipo = 'tarefa' | 'prova' | 'entrega' | 'trabalho_grupo' | 'reuniao'
export type TarefaStatus = 'a_fazer' | 'fazendo' | 'feito'
export type TarefaPrioridade = 'baixa' | 'normal' | 'alta' | 'maxima'

export type Area = {
  id: string
  user_id: string
  nome: string
  codigo: string | null
  cor: string | null
  ordem: number
  arquivada: boolean
  created_at: string
  updated_at: string
}

export type Membro = {
  id: string
  user_id: string
  nome: string
  funcao: string | null
  telefone: string | null
  ativo: boolean
  ordem: number
  created_at: string
  updated_at: string
}

export type Tarefa = {
  id: string
  user_id: string
  numero: number
  area_id: string | null
  responsavel_id: string | null
  reuniao_id: string | null
  titulo: string
  descricao: string | null
  tipo: TarefaTipo
  status: TarefaStatus
  prioridade: TarefaPrioridade
  prazo: string | null
  prazo_dia_inteiro: boolean
  ordem: number
  concluida_em: string | null
  created_at: string
  updated_at: string
}

export type Subtarefa = {
  id: string
  user_id: string
  tarefa_id: string
  titulo: string
  feita: boolean
  ordem: number
  created_at: string
  updated_at: string
}

export type StatusReuniao = 'agendada' | 'realizada' | 'cancelada'

export type Reuniao = {
  id: string
  user_id: string
  titulo: string
  inicio: string
  fim: string | null
  local: string | null
  area_id: string | null
  status: StatusReuniao
  ata: string | null
  created_at: string
  updated_at: string
}

export type ItemPauta = {
  id: string
  user_id: string
  reuniao_id: string
  texto: string
  discutido: boolean
  notas: string | null
  ordem: number
  created_at: string
  updated_at: string
}

export type Participante = {
  id: string
  user_id: string
  reuniao_id: string
  membro_id: string
  presente: boolean | null
  created_at: string
  updated_at: string
}

export type InscricaoPush = {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  fuso: string
  dispositivo: string | null
  created_at: string
  updated_at: string
}

type Opcional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export type AreaInsert = Opcional<
  Omit<Area, 'created_at' | 'updated_at'>,
  'id' | 'user_id' | 'codigo' | 'cor' | 'ordem' | 'arquivada'
>
export type TarefaInsert = Opcional<
  Omit<Tarefa, 'numero' | 'created_at' | 'updated_at' | 'concluida_em'>,
  'id' | 'user_id' | 'area_id' | 'responsavel_id' | 'reuniao_id' | 'descricao' | 'tipo' | 'status' | 'prioridade' | 'prazo' | 'prazo_dia_inteiro' | 'ordem'
>

export type MembroInsert = Opcional<
  Omit<Membro, 'created_at' | 'updated_at'>,
  'id' | 'user_id' | 'funcao' | 'telefone' | 'ativo' | 'ordem'
>

export type InscricaoPushInsert = Opcional<
  Omit<InscricaoPush, 'id' | 'created_at' | 'updated_at'>,
  'user_id' | 'fuso' | 'dispositivo'
>

export type Database = {
  public: {
    Tables: {
      areas: { Row: Area; Insert: AreaInsert; Update: Partial<AreaInsert>; Relationships: [] }
      tarefas: { Row: Tarefa; Insert: TarefaInsert; Update: Partial<TarefaInsert>; Relationships: [] }
      membros: { Row: Membro; Insert: MembroInsert; Update: Partial<MembroInsert>; Relationships: [] }
      push_subscriptions: { Row: InscricaoPush; Insert: InscricaoPushInsert; Update: Partial<InscricaoPushInsert>; Relationships: [] }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      tarefa_tipo: TarefaTipo
      tarefa_status: TarefaStatus
      tarefa_prioridade: TarefaPrioridade
    }
    CompositeTypes: Record<string, never>
  }
}
