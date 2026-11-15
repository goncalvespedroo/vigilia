/**
 * Missões concluídas há instantes: os cartões usam isso para tocar a
 * animação de "arquivado" uma única vez (DESIGN-DIRECTIVE §7).
 */
const recentes = new Map<string, number>()
const JANELA = 1600

export function marcarConcluida(id: string) {
  recentes.set(id, Date.now())
}

export function recemConcluida(id: string): boolean {
  const t = recentes.get(id)
  if (t === undefined) return false
  if (Date.now() - t > JANELA) {
    recentes.delete(id)
    return false
  }
  return true
}
