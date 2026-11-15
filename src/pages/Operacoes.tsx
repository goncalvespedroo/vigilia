import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useDados } from '../lib/dados'
import { CapturaRapida } from '../components/CapturaRapida'
import { Kanban } from '../components/Kanban'
import { Checklist } from '../components/Checklist'
import { EditorTarefa } from '../components/EditorTarefa'
import { EditorArea } from '../components/EditorArea'
import s from './Operacoes.module.css'

type Visao = 'kanban' | 'checklist'
const CHAVE_VISAO = 'vigilia.visao'

function visaoSalva(): Visao {
  try {
    return localStorage.getItem(CHAVE_VISAO) === 'checklist' ? 'checklist' : 'kanban'
  } catch {
    return 'kanban'
  }
}

export function Operacoes() {
  const { areas, tarefas, carregando, erro } = useDados()
  const [params, setParams] = useSearchParams()
  const [editando, setEditando] = useState<string | null>(null)
  // 'nova' = criando; id = editando aquela operação
  const [editandoArea, setEditandoArea] = useState<string | null>(null)

  const v = params.get('v')
  const visao: Visao = v === 'kanban' || v === 'checklist' ? v : visaoSalva()
  const filtro = params.get('area') // id da área, 'nenhuma' ou null (todas)

  function mudar(chave: string, valor: string | null) {
    const p = new URLSearchParams(params)
    if (valor) p.set(chave, valor)
    else p.delete(chave)
    setParams(p, { replace: true })
  }

  function trocarVisao(nova: Visao) {
    try {
      localStorage.setItem(CHAVE_VISAO, nova)
    } catch {
      /* armazenamento indisponível: só a URL guarda a escolha */
    }
    mudar('v', nova)
  }

  const visiveis =
    filtro === 'nenhuma' ? tarefas.filter((t) => !t.area_id) : filtro ? tarefas.filter((t) => t.area_id === filtro) : tarefas
  const temSemArea = tarefas.some((t) => !t.area_id)
  const emEdicao = editando ? tarefas.find((t) => t.id === editando) : undefined
  const areaFiltrada = filtro && filtro !== 'nenhuma' ? areas.find((a) => a.id === filtro) : undefined
  const areaPadrao = areaFiltrada && !areaFiltrada.arquivada ? areaFiltrada.id : null
  const areaEmEdicao = editandoArea && editandoArea !== 'nova' ? areas.find((a) => a.id === editandoArea) : undefined

  return (
    <>
      <section className={s.cabeca}>
        <div className={s.cabecaTexto}>
          <span className="mono">
            {areaFiltrada ? `// OPERAÇÃO ${areaFiltrada.codigo ?? ''}${areaFiltrada.arquivada ? ' · ARQUIVADA' : ''}` : '// QUADRO DE OPERAÇÕES'}
          </span>
          <div className={s.tituloLinha}>
            {areaFiltrada && <span className="ponto-area" style={{ background: areaFiltrada.cor ?? 'var(--c-texto-2)', width: 14, height: 14 }} />}
            <h1 className={s.titulo}>{areaFiltrada ? areaFiltrada.nome : filtro === 'nenhuma' ? 'Sem área' : 'Operações'}</h1>
            {areaFiltrada && (
              <button className="btn" onClick={() => setEditandoArea(areaFiltrada.id)}>
                Editar operação
              </button>
            )}
          </div>
        </div>
        <div className={s.alternador} role="group" aria-label="Visualização">
          {(['kanban', 'checklist'] as const).map((op) => (
            <button key={op} aria-pressed={visao === op} className={visao === op ? s.ativo : undefined} onClick={() => trocarVisao(op)}>
              {op === 'kanban' ? 'Kanban' : 'Checklist'}
            </button>
          ))}
        </div>
      </section>

      <CapturaRapida areaPadrao={areaPadrao} />

      <nav className={s.filtros} aria-label="Filtrar por área">
        <button aria-pressed={!filtro} className={!filtro ? s.filtroAtivo : undefined} onClick={() => mudar('area', null)}>
          Todas
        </button>
        {areas
          .filter((a) => !a.arquivada)
          .map((a) => (
            <button key={a.id} aria-pressed={filtro === a.id} className={filtro === a.id ? s.filtroAtivo : undefined} onClick={() => mudar('area', a.id)}>
              <span className="ponto-area" style={{ background: a.cor ?? 'var(--c-texto-2)' }} />
              {a.nome}
            </button>
          ))}
        {areaFiltrada?.arquivada && (
          <button aria-pressed className={s.filtroAtivo}>
            <span className="ponto-area" style={{ background: areaFiltrada.cor ?? 'var(--c-texto-2)' }} />
            {areaFiltrada.nome}
          </button>
        )}
        {temSemArea && (
          <button aria-pressed={filtro === 'nenhuma'} className={filtro === 'nenhuma' ? s.filtroAtivo : undefined} onClick={() => mudar('area', 'nenhuma')}>
            Sem área
          </button>
        )}
        <button className={s.nova} onClick={() => setEditandoArea('nova')} aria-label="Nova operação">
          + Nova
        </button>
      </nav>

      {erro && <p className={s.erro}>Falha ao consultar a central: {erro}</p>}
      {carregando ? (
        <span className="mono">// CARREGANDO DOSSIÊS…</span>
      ) : visao === 'kanban' ? (
        <Kanban tarefas={visiveis} onAbrir={setEditando} />
      ) : (
        <Checklist tarefas={visiveis} onAbrir={setEditando} />
      )}

      {editandoArea === 'nova' && (
        <EditorArea key="nova" onFechar={() => setEditandoArea(null)} onCriada={(id) => mudar('area', id)} />
      )}
      {areaEmEdicao && <EditorArea key={areaEmEdicao.id} area={areaEmEdicao} onFechar={() => setEditandoArea(null)} />}
      {emEdicao && <EditorTarefa key={emEdicao.id} tarefa={emEdicao} onFechar={() => setEditando(null)} />}
    </>
  )
}
