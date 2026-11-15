import { useState, type KeyboardEvent } from 'react'
import { useDados } from '../lib/dados'
import s from './Subtarefas.module.css'

/** Checklist de subtarefas de uma tarefa. Cada mudança é salva na hora. */
export function Subtarefas({ tarefaId }: { tarefaId: string }) {
  const { subtarefas, criarSubtarefa, atualizarSubtarefa, excluirSubtarefa } = useDados()
  const [nova, setNova] = useState('')
  const lista = subtarefas.filter((x) => x.tarefa_id === tarefaId)
  const feitas = lista.filter((x) => x.feita).length

  // Enter dentro do formulário do dossiê não pode submeter o formulário inteiro.
  function aoTeclarNova(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (!nova.trim()) return
    void criarSubtarefa(tarefaId, nova)
    setNova('')
  }

  return (
    <section className={s.subtarefas}>
      <div className={s.topo}>
        <span className="mono">SUBTAREFAS{lista.length ? ` · ${feitas}/${lista.length}` : ''}</span>
        <span className="mono">SALVAS NA HORA</span>
      </div>
      {lista.length > 0 && (
        <div className={s.barra} aria-hidden="true">
          <div style={{ width: `${(feitas / lista.length) * 100}%` }} />
        </div>
      )}
      {lista.map((st) => (
        <div key={st.id} className={s.item} data-feita={st.feita || undefined}>
          <input
            type="checkbox"
            className={s.check}
            checked={st.feita}
            aria-label={st.feita ? `Reabrir: ${st.titulo}` : `Concluir: ${st.titulo}`}
            onChange={() => void atualizarSubtarefa(st.id, { feita: !st.feita })}
          />
          <input
            className={s.texto}
            defaultValue={st.titulo}
            aria-label="Texto da subtarefa"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                e.currentTarget.blur()
              }
            }}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (!v) e.target.value = st.titulo
              else if (v !== st.titulo) void atualizarSubtarefa(st.id, { titulo: v })
            }}
          />
          <button type="button" className={s.remover} aria-label={`Remover subtarefa: ${st.titulo}`} onClick={() => void excluirSubtarefa(st.id)}>
            ×
          </button>
        </div>
      ))}
      <label className={s.nova}>
        <span aria-hidden="true">+</span>
        <span className="sr">Nova subtarefa</span>
        <input value={nova} onChange={(e) => setNova(e.target.value)} onKeyDown={aoTeclarNova} placeholder="Adicionar subtarefa (Enter)" enterKeyHint="enter" />
      </label>
    </section>
  )
}
