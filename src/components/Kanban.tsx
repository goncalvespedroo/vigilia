import { useState, type DragEvent } from 'react'
import type { Tarefa, TarefaStatus } from '../types/database'
import { useDados } from '../lib/dados'
import { AVANCO, codigoTarefa, ORDEM_STATUS, STATUS } from '../lib/rotulos'
import { MetaTarefa } from './MetaTarefa'
import s from './Kanban.module.css'
import { recemConcluida } from '../lib/conclusao'

const SETE_DIAS = 7 * 86_400_000

interface Alvo {
  status: TarefaStatus
  antesDe: string | null // null = fim da coluna
}

export function Kanban({ tarefas, onAbrir }: { tarefas: Tarefa[]; onAbrir: (id: string) => void }) {
  const { areaPorId, atualizarTarefa } = useDados()
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [alvo, setAlvo] = useState<Alvo | null>(null)

  const limite = Date.now() - SETE_DIAS
  const colunas = Object.fromEntries(
    ORDEM_STATUS.map((st) => [st, tarefas.filter((t) => t.status === st).sort((a, b) => a.ordem - b.ordem)]),
  ) as Record<TarefaStatus, Tarefa[]>
  const feitasVisiveis = colunas.feito.filter((t) => !t.concluida_em || new Date(t.concluida_em).getTime() >= limite)
  const feitasOcultas = colunas.feito.length - feitasVisiveis.length
  colunas.feito = feitasVisiveis

  function marcar(novo: Alvo) {
    if (alvo?.status !== novo.status || alvo.antesDe !== novo.antesDe) setAlvo(novo)
  }

  function soltar() {
    const id = arrastando
    const destino = alvo
    setArrastando(null)
    setAlvo(null)
    if (!id || !destino) return
    const tarefa = tarefas.find((t) => t.id === id)
    if (!tarefa || destino.antesDe === id) return

    const lista = colunas[destino.status].filter((t) => t.id !== id)
    const i = destino.antesDe ? lista.findIndex((t) => t.id === destino.antesDe) : -1
    let ordem: number
    if (i === -1) ordem = lista.length ? lista[lista.length - 1]!.ordem + 1 : 0
    else {
      const anterior = lista[i - 1]
      ordem = anterior ? (anterior.ordem + lista[i]!.ordem) / 2 : lista[i]!.ordem - 1
    }
    void atualizarTarefa(id, destino.status !== tarefa.status ? { status: destino.status, ordem } : { ordem })
  }

  function sobreCartao(e: DragEvent<HTMLElement>, status: TarefaStatus, idx: number) {
    if (!arrastando) return
    e.preventDefault()
    e.stopPropagation()
    const r = e.currentTarget.getBoundingClientRect()
    const depois = e.clientY > r.top + r.height / 2
    const lista = colunas[status]
    marcar({ status, antesDe: depois ? (lista[idx + 1]?.id ?? null) : lista[idx]!.id })
  }

  return (
    <div className={s.quadro}>
      {ORDEM_STATUS.map((st) => {
        const lista = colunas[st]
        const ativa = alvo?.status === st
        return (
          <section
            key={st}
            className={`${s.coluna} ${ativa ? s.colunaAlvo : ''}`}
            aria-label={STATUS[st]}
            onDragOver={(e) => {
              if (!arrastando) return
              e.preventDefault()
              marcar({ status: st, antesDe: null })
            }}
            onDrop={(e) => {
              e.preventDefault()
              soltar()
            }}
          >
            <header className={s.cabeca} data-status={st}>
              <h2>{STATUS[st]}</h2>
              <span className="mono">{String(lista.length).padStart(2, '0')}</span>
            </header>

            <div className={s.lista}>
              {lista.map((t, idx) => (
                <div key={t.id}>
                  {ativa && alvo.antesDe === t.id && <div className={s.marcador} />}
                  <article
                    className={`${s.cartao} ${arrastando === t.id ? s.arrastando : ''}`}
                    data-status={t.status}
                    data-recem={recemConcluida(t.id) || undefined}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', t.id)
                      setArrastando(t.id)
                    }}
                    onDragEnd={() => {
                      setArrastando(null)
                      setAlvo(null)
                    }}
                    onDragOver={(e) => sobreCartao(e, st, idx)}
                  >
                    <div className={s.cartaoTopo}>
                      <span className={s.codigo}>
                        {codigoTarefa(t.numero)}
                        {t.area_id && areaPorId.get(t.area_id)?.codigo ? ` · ${areaPorId.get(t.area_id)!.codigo}` : ''}
                      </span>
                      <button
                        className={s.avancar}
                        data-para={AVANCO[t.status].para}
                        onClick={() => void atualizarTarefa(t.id, { status: AVANCO[t.status].para, ordem: -Date.now() })}
                      >
                        {AVANCO[t.status].rotulo}
                      </button>
                    </div>
                    <button className={s.titulo} onClick={() => onAbrir(t.id)}>
                      {t.titulo}
                    </button>
                    <div className={s.meta}>
                      <MetaTarefa tarefa={t} area={t.area_id ? areaPorId.get(t.area_id) : undefined} />
                    </div>
                  </article>
                </div>
              ))}
              {ativa && alvo.antesDe === null && <div className={s.marcador} />}
              {lista.length === 0 && !ativa && <p className={s.vazio}>Nenhuma missão.</p>}
              {st === 'feito' && feitasOcultas > 0 && (
                <p className={s.vazio}>+{feitasOcultas} encerradas há mais de 7 dias</p>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
