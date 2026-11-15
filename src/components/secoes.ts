/** Seções da navegação principal (barra lateral, barra inferior e busca). */
export interface Secao {
  para: string
  rotulo: string
  grupo: 'central' | 'equipe'
  /** Caminho SVG 24×24, traço. */
  icone: string
  /** Aparece na barra inferior do celular. */
  movel: boolean
}

export const SECOES: Secao[] = [
  { para: '/', rotulo: 'Painel', grupo: 'central', movel: true, icone: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z' },
  { para: '/hoje', rotulo: 'Hoje', grupo: 'central', movel: true, icone: 'M9 6h12M9 12h12M9 18h12M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2' },
  { para: '/operacoes', rotulo: 'Operações', grupo: 'central', movel: true, icone: 'M3 7h6l2 2h10v10H3z' },
  { para: '/reunioes', rotulo: 'Reuniões', grupo: 'central', movel: true, icone: 'M4 6h16v10H8l-4 4z' },
  { para: '/agentes', rotulo: 'Agentes', grupo: 'equipe', movel: true, icone: 'M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .7 3.2 2.5 3.5 5.2' },
]
