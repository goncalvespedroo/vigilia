import { createContext, useContext } from 'react'

/** Ações globais da casca (Layout): disponíveis em qualquer tela. */
export interface Central {
  /** Abre o dossiê (editor) de uma missão, de qualquer tela. */
  abrirTarefa: (id: string) => void
  /** Abre a busca (Ctrl K). */
  abrirBusca: () => void
  /** Abre o registro rápido de nova missão. */
  novaMissao: () => void
}

export const CentralContexto = createContext<Central | null>(null)

export function useCentral(): Central {
  const c = useContext(CentralContexto)
  if (!c) throw new Error('useCentral fora do Layout')
  return c
}

/** Minúsculas e sem acentos, para comparar textos digitados. */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/**
 * Pontua o quanto `texto` casa com a busca (menor = melhor; null = não casa).
 * Todas as palavras da busca precisam aparecer.
 */
export function pontuar(texto: string, busca: string): number | null {
  const alvo = normalizar(texto)
  const termos = normalizar(busca).split(/\s+/).filter(Boolean)
  if (!termos.length) return null
  let total = 0
  for (const t of termos) {
    const i = alvo.indexOf(t)
    if (i < 0) return null
    total += i === 0 ? 0 : /[\s\-—·#/(]/.test(alvo[i - 1]!) ? 1 : 3
  }
  return total
}
