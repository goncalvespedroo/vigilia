import type { Area, Tarefa } from '../types/database'
import { formatarPrazo, situacao } from '../lib/prazo'
import { TIPO } from '../lib/rotulos'
import { useDados } from '../lib/dados'

/** Selos de área, prazo, tipo e prioridade de uma tarefa. */
export function MetaTarefa({ tarefa: t, area }: { tarefa: Tarefa; area?: Area }) {
  const sit = situacao(t)
  const { membroPorId, subtarefas } = useDados()
  const subs = subtarefas.filter((x) => x.tarefa_id === t.id)
  const subsFeitas = subs.filter((x) => x.feita).length
  const responsavel = t.responsavel_id ? membroPorId.get(t.responsavel_id) : undefined
  return (
    <>
      {responsavel && <span className="selo" title={`Responsável: ${responsavel.nome}`}>▸ {responsavel.nome.toUpperCase()}</span>}
      {area && (
        <span className="selo">
          <span className="ponto-area" style={{ background: area.cor ?? 'var(--c-texto-2)' }} />
          {area.nome.toUpperCase()}
        </span>
      )}
      {t.prazo && (
        <span className={`selo ${sit === 'atrasada' ? 'selo--atrasada' : sit === 'hoje' ? 'selo--hoje' : ''}`}>
          {sit === 'atrasada' && 'ATRASADA · '}
          {formatarPrazo(t.prazo, t.prazo_dia_inteiro)}
        </span>
      )}
      {subs.length > 0 && (
        <span className="selo" title={`${subsFeitas} de ${subs.length} subtarefas concluídas`}>
          ☑ {subsFeitas}/{subs.length}
        </span>
      )}
      {t.tipo !== 'tarefa' && <span className="selo">{TIPO[t.tipo].toUpperCase()}</span>}
      {t.prioridade === 'maxima' && <span className="selo selo--hoje">▲▲ MÁXIMA</span>}
      {t.prioridade === 'alta' && <span className="selo selo--andamento">▲ ALTA</span>}
    </>
  )
}
