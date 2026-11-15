import type { Membro, Tarefa } from '../types/database'
import { formatarPrazo, situacao } from './prazo'

export type SituacaoEntrega = 'atrasado' | 'em_campo' | 'entregue'

export function situacaoEntrega(t: Tarefa, agora = new Date()): SituacaoEntrega {
  if (t.status === 'feito') return 'entregue'
  return situacao(t, agora) === 'atrasada' ? 'atrasado' : 'em_campo'
}

export const ROTULO_ENTREGA: Record<SituacaoEntrega, string> = {
  atrasado: 'ATRASADO',
  em_campo: 'EM CAMPO',
  entregue: 'ENTREGUE',
}

/** Atrasadas primeiro, depois por prazo (sem prazo no fim). */
export function ordenarEntregas(a: Tarefa, b: Tarefa, agora = new Date()) {
  const peso = (t: Tarefa) => ({ atrasado: 0, em_campo: 1, entregue: 2 })[situacaoEntrega(t, agora)]
  return peso(a) - peso(b) || (a.prazo ?? '9').localeCompare(b.prazo ?? '9')
}

/** Normaliza para só dígitos com DDI; números brasileiros sem DDI ganham 55. */
export function normalizarTelefone(bruto: string) {
  const d = bruto.replace(/\D/g, '')
  if (!d) return null
  return d.length === 10 || d.length === 11 ? `55${d}` : d
}

export function formatarTelefone(t: string) {
  const m = t.match(/^55(\d{2})(\d{4,5})(\d{4})$/)
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : `+${t}`
}

function linhaEntrega(t: Tarefa, agora: Date) {
  if (!t.prazo) return `• ${t.titulo}`
  const quando = formatarPrazo(t.prazo, t.prazo_dia_inteiro, agora).toLowerCase()
  return situacaoEntrega(t, agora) === 'atrasado' ? `• ${t.titulo} — atrasada (prazo: ${quando})` : `• ${t.titulo} — até ${quando}`
}

/** Mensagem de lembrete para um membro (texto que vai para pessoas reais: tom normal). */
export function mensagemCobranca(m: Membro, pendentes: Tarefa[], agora = new Date()) {
  const primeiro = m.nome.split(' ')[0]
  if (!pendentes.length) return `Oi, ${primeiro}! Tudo certo por aí? Por aqui não tem nenhuma entrega pendente sua. 👍`
  return [
    `Oi, ${primeiro}! Tudo bem? Passando pra lembrar ${pendentes.length === 1 ? 'da sua entrega' : 'das suas entregas'}:`,
    ...pendentes.map((t) => linhaEntrega(t, agora)),
    '',
    'Qualquer dificuldade, me avisa!',
  ].join('\n')
}

/** Mensagem para o grupo da equipe, com as pendências de todos. */
export function mensagemGrupo(porMembro: { membro: Membro; pendentes: Tarefa[] }[], agora = new Date()) {
  const comPendencia = porMembro.filter((x) => x.pendentes.length)
  if (!comPendencia.length) return 'Pessoal, nenhuma entrega pendente no momento. Bom trabalho! 🎉'
  return [
    'Pessoal, status das entregas:',
    ...comPendencia.flatMap(({ membro, pendentes }) => ['', `*${membro.nome}*`, ...pendentes.map((t) => linhaEntrega(t, agora))]),
  ].join('\n')
}

export const linkWhatsApp = (telefone: string | null, texto: string) =>
  `https://wa.me/${telefone ?? ''}?text=${encodeURIComponent(texto)}`
