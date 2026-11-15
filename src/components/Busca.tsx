import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import { useDados } from '../lib/dados'
import { pontuar, useCentral } from '../lib/central'
import { codigoTarefa } from '../lib/rotulos'
import type { TarefaStatus } from '../types/database'
import { formatarPrazo } from '../lib/prazo'
import { diaCurto } from '../lib/reunioes'
import { SECOES } from './secoes'
import s from './Busca.module.css'

interface Resultado {
  id: string
  grupo: 'Seções' | 'Missões' | 'Operações' | 'Reuniões' | 'Agentes'
  titulo: string
  meta: string
  cor?: string | null
  feito?: boolean
  pontos: number
  abrir: () => void
}

const LIMITE_GRUPO = 6
const SITUACAO: Record<TarefaStatus, string> = { a_fazer: 'A FAZER', fazendo: 'EM ANDAMENTO', feito: 'CONCLUÍDA' }

/** Busca no arquivo (Ctrl K): missões, operações, reuniões, agentes e seções. */
export function Busca({ onFechar }: { onFechar: () => void }) {
  const { tarefas, areas, areaPorId, reunioes, membros } = useDados()
  const { abrirTarefa, novaMissao } = useCentral()
  const navegar = useNavigate()
  const dialogo = useRef<HTMLDialogElement>(null)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)

  useEffect(() => {
    const d = dialogo.current
    if (d && !d.open) d.showModal()
  }, [])

  const fechar = () => dialogo.current?.close()
  const ir = (para: string) => () => {
    fechar()
    navegar(para)
  }

  const resultados = useMemo<Resultado[]>(() => {
    const busca = q.trim()
    if (!busca) {
      return [
        { id: 'nova', grupo: 'Seções', titulo: 'Nova missão', meta: 'TECLA N', pontos: 0, abrir: () => { fechar(); novaMissao() } },
        ...SECOES.map((sec) => ({ id: sec.para, grupo: 'Seções' as const, titulo: sec.rotulo, meta: 'IR PARA', pontos: 0, abrir: ir(sec.para) })),
      ]
    }
    const lista: Resultado[] = []
    const add = (r: Omit<Resultado, 'pontos'>, ...textos: (string | null | undefined)[]) => {
      const ps = textos.filter(Boolean).map((t) => pontuar(t!, busca)).filter((p): p is number => p !== null)
      if (ps.length) lista.push({ ...r, pontos: Math.min(...ps) })
    }
    for (const sec of SECOES) add({ id: sec.para, grupo: 'Seções', titulo: sec.rotulo, meta: 'IR PARA', abrir: ir(sec.para) }, sec.rotulo)
    for (const t of tarefas) {
      const area = t.area_id ? areaPorId.get(t.area_id) : undefined
      const meta = [codigoTarefa(t.numero), area?.nome.toUpperCase(), t.prazo ? formatarPrazo(t.prazo, t.prazo_dia_inteiro) : null, SITUACAO[t.status]]
        .filter(Boolean)
        .join(' · ')
      add(
        { id: t.id, grupo: 'Missões', titulo: t.titulo, meta, cor: area?.cor, feito: t.status === 'feito', abrir: () => { fechar(); abrirTarefa(t.id) } },
        t.titulo,
        codigoTarefa(t.numero),
        String(t.numero),
        t.descricao,
      )
    }
    for (const a of areas) {
      const abertas = tarefas.filter((t) => t.area_id === a.id && t.status !== 'feito').length
      add(
        { id: a.id, grupo: 'Operações', titulo: a.nome, meta: `${a.codigo ?? ''} · ${abertas} ABERTA${abertas === 1 ? '' : 'S'}${a.arquivada ? ' · ARQUIVADA' : ''}`, cor: a.cor, abrir: ir(`/operacoes?area=${a.id}`) },
        a.nome,
        a.codigo,
      )
    }
    for (const r of reunioes) {
      add({ id: r.id, grupo: 'Reuniões', titulo: r.titulo, meta: diaCurto(r.inicio).toUpperCase(), feito: r.status !== 'agendada', abrir: ir(`/reunioes/${r.id}`) }, r.titulo, r.local)
    }
    for (const m of membros) {
      add({ id: m.id, grupo: 'Agentes', titulo: m.nome, meta: (m.funcao ?? 'AGENTE').toUpperCase(), abrir: ir('/agentes') }, m.nome, m.funcao)
    }
    // Concluídas e encerradas descem; dentro do grupo, melhor pontuação primeiro.
    lista.sort((a, b) => Number(!!a.feito) - Number(!!b.feito) || a.pontos - b.pontos)
    const ordem: Resultado['grupo'][] = ['Seções', 'Missões', 'Operações', 'Reuniões', 'Agentes']
    return ordem.flatMap((g) => lista.filter((r) => r.grupo === g).slice(0, LIMITE_GRUPO))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tarefas, areas, areaPorId, reunioes, membros])

  useEffect(() => setSel(0), [q])
  useEffect(() => {
    document.getElementById(`busca-${sel}`)?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  function tecla(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSel((i) => Math.min(resultados.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSel((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      resultados[sel]?.abrir()
    }
  }

  let grupoAnterior = ''
  return (
    <dialog
      ref={dialogo}
      className={s.dialogo}
      onClose={onFechar}
      onClick={(e) => e.target === dialogo.current && fechar()}
      aria-label="Buscar no arquivo"
    >
      <div className={s.campo}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M16.5 16.5 21 21" />
        </svg>
        <input
          autoFocus
          type="search"
          placeholder="Buscar missões, operações, reuniões, agentes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={tecla}
          role="combobox"
          aria-expanded="true"
          aria-controls="busca-lista"
          aria-activedescendant={resultados.length ? `busca-${sel}` : undefined}
          aria-label="Buscar no arquivo"
        />
        <kbd className={s.tecla}>ESC</kbd>
      </div>

      <ul id="busca-lista" role="listbox" className={s.lista} aria-label="Resultados">
        {resultados.map((r, i) => {
          const cabeca = r.grupo !== grupoAnterior ? r.grupo : null
          grupoAnterior = r.grupo
          return (
            <li key={`${r.grupo}-${r.id}`} role="presentation">
              {cabeca && <span className={s.grupo}>{cabeca.toUpperCase()}</span>}
              <div
                id={`busca-${i}`}
                role="option"
                aria-selected={i === sel}
                className={s.item}
                data-feito={r.feito ? '' : undefined}
                onMouseMove={() => i !== sel && setSel(i)}
                onClick={r.abrir}
              >
                {r.cor !== undefined && <span className="ponto-area" style={{ background: r.cor ?? 'var(--text-2)' }} />}
                <span className={s.texto}>
                  <span className={s.titulo}>{r.titulo}</span>
                  <span className={s.meta}>{r.meta}</span>
                </span>
                {i === sel && <span className={s.enter} aria-hidden="true">↵</span>}
              </div>
            </li>
          )
        })}
      </ul>
      {q.trim() && !resultados.length && (
        <div className="vazio" style={{ margin: 'var(--e-4)' }}>
          <strong>Nada no arquivo</strong>
          Nenhum registro corresponde a “{q.trim()}”.
        </div>
      )}
      <div className={s.rodape}>
        <span>↑↓ NAVEGAR</span>
        <span>↵ ABRIR</span>
        <span>CTRL K · BUSCAR</span>
      </div>
    </dialog>
  )
}
