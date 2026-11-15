import type { TarefaPrioridade, TarefaStatus, TarefaTipo } from '../types/database'

export const STATUS: Record<TarefaStatus, string> = {
  a_fazer: 'A fazer',
  fazendo: 'Em andamento',
  feito: 'Concluídas',
}
export const ORDEM_STATUS: TarefaStatus[] = ['a_fazer', 'fazendo', 'feito']

export const TIPO: Record<TarefaTipo, string> = {
  tarefa: 'Tarefa',
  prova: 'Prova',
  entrega: 'Entrega',
  trabalho_grupo: 'Trabalho em grupo',
  reuniao: 'Reunião',
}

export const PRIORIDADE: Record<TarefaPrioridade, string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  maxima: 'Máxima',
}
export const PESO_PRIORIDADE: Record<TarefaPrioridade, number> = { maxima: 0, alta: 1, normal: 2, baixa: 3 }

/** Próximo passo do botão rápido do cartão. */
export const AVANCO: Record<TarefaStatus, { para: TarefaStatus; rotulo: string }> = {
  a_fazer: { para: 'fazendo', rotulo: 'Iniciar' },
  fazendo: { para: 'feito', rotulo: 'Concluir' },
  feito: { para: 'a_fazer', rotulo: 'Reabrir' },
}

export const codigoTarefa = (numero: number) => (numero ? `#${String(numero).padStart(4, '0')}` : '#····')
