import type { TarefaPrioridade } from '../types/database'
import { PRIORIDADE } from '../lib/rotulos'

const NIVEL: Record<TarefaPrioridade, number> = { baixa: 1, normal: 2, alta: 3, maxima: 4 }

/** Prioridade em 4 barras crescentes (sistema de design · 03). */
export function BarrasPrioridade({ prioridade, rotulo = true }: { prioridade: TarefaPrioridade; rotulo?: boolean }) {
  const n = NIVEL[prioridade]
  return (
    <span className="prioridade" data-nivel={prioridade} title={`Prioridade ${PRIORIDADE[prioridade].toLowerCase()}`}>
      <span className="prioridade__barras" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <i key={i} data-on={i <= n ? '' : undefined} />
        ))}
      </span>
      {rotulo ? PRIORIDADE[prioridade] : <span className="sr">Prioridade {PRIORIDADE[prioridade]}</span>}
    </span>
  )
}
