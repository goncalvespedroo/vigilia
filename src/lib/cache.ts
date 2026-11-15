/**
 * Cópia local dos dados para leitura offline. Fica no localStorage, por usuário:
 * o volume é pequeno (centenas de registros ≈ dezenas de KB) e a leitura é síncrona,
 * o que permite desenhar a tela já no primeiro render.
 */
export interface Instantaneo<C> {
  colecoes: Partial<C>
  salvoEm: string // ISO
}

const VERSAO = 3 // v3: formato genérico por coleção
const chave = (userId: string) => `vigilia.cache.v${VERSAO}.${userId}`

export function lerCache<C>(userId: string): Instantaneo<C> | null {
  try {
    const bruto = localStorage.getItem(chave(userId))
    if (!bruto) return null
    const dados = JSON.parse(bruto) as Instantaneo<C>
    return dados && typeof dados.colecoes === 'object' && dados.salvoEm ? dados : null
  } catch {
    return null
  }
}

export function salvarCache<C>(userId: string, colecoes: C, salvoEm: Date) {
  try {
    localStorage.setItem(chave(userId), JSON.stringify({ colecoes, salvoEm: salvoEm.toISOString() }))
  } catch {
    /* cota cheia ou armazenamento bloqueado: segue sem cache */
  }
}

/** Remove a cópia local de todos os usuários (ao encerrar sessão), inclusive versões antigas. */
export function limparCache() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('vigilia.cache.'))
      .forEach((k) => localStorage.removeItem(k))
  } catch {
    /* nada a limpar */
  }
}
