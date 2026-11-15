import type { Tarefa } from '../types/database'
import { useDados } from '../lib/dados'
import { PESO_PRIORIDADE, STATUS } from '../lib/rotulos'
import { MetaTarefa } from './MetaTarefa'
import s from './Checklist.module.css'

const SETE_DIAS = 7 * 86_400_000

/** Pendentes por prazo (sem prazo no fim), depois prioridade. */
function ordenar(a: Tarefa, b: Tarefa) {
  if (a.prazo && b.prazo && a.prazo !== b.prazo) return a.prazo < b.prazo ? -1 : 1
  if (!!a.prazo !== !!b.prazo) return a.prazo ? -1 : 1
  const p = PESO_PRIORIDADE[a.prioridade] - PESO_PRIORIDADE[b.prioridade]
  return p || a.ordem - b.ordem
}

export function Checklist({ tarefas, onAbrir }: { tarefas: Tarefa[]; onAbrir: (id: string) => void }) {
  const limite = Date.now() - SETE_DIAS
  const pendentes = tarefas.filter((t) => t.status !== 'feito').sort(ordenar)
  const feitas = tarefas
    .filter((t) => t.status === 'feito' && (!t.concluida_em || new Date(t.concluida_em).getTime() >= limite))
    .sort((a, b) => (b.concluida_em ?? '').localeCompare(a.concluida_em ?? ''))

  return (
    <div className={s.lista}>
      <section className="card">
        <header className={s.cabeca}>
          <h2>Pendentes</h2>
          <span className="mono">{String(pendentes.length).padStart(2, '0')}</span>
        </header>
        {pendentes.length === 0 && <p className={s.vazio}>Nenhuma pendência. A vigília está em dia.</p>}
        {pendentes.map((t) => <LinhaTarefa key={t.id} t={t} onAbrir={onAbrir} />)}
      </section>

      {feitas.length > 0 && (
        <details className="card">
          <summary className={s.cabeca}>
            <h2>Concluídas nos últimos 7 dias</h2>
            <span className="mono">{String(feitas.length).padStart(2, '0')}</span>
          </summary>
          {feitas.map((t) => <LinhaTarefa key={t.id} t={t} onAbrir={onAbrir} />)}
        </details>
      )}
    </div>
  )
}

export function LinhaTarefa({ t, onAbrir }: { t: Tarefa; onAbrir: (id: string) => void }) {
  const { areaPorId, atualizarTarefa } = useDados()
  const feita = t.status === 'feito'
  return (
    <div className={s.linha} data-status={t.status}>
      <input
        type="checkbox"
        className={s.check}
        checked={feita}
        aria-label={feita ? `Reabrir: ${t.titulo}` : `Concluir: ${t.titulo}`}
        onChange={() => void atualizarTarefa(t.id, { status: feita ? 'a_fazer' : 'feito', ordem: -Date.now() })}
      />
      <div className={s.corpo}>
        <button className={s.titulo} onClick={() => onAbrir(t.id)}>
          {t.titulo}
        </button>
        <div className={s.meta}>
          {t.status === 'fazendo' && <span className="selo selo--andamento">{STATUS.fazendo.toUpperCase()}</span>}
          <MetaTarefa tarefa={t} area={t.area_id ? areaPorId.get(t.area_id) : undefined} />
        </div>
      </div>
    </div>
  )
}
