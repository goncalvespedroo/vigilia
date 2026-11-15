import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Tarefa, TarefaPrioridade, TarefaStatus, TarefaTipo } from '../types/database'
import { useDados } from '../lib/dados'
import { camposParaPrazo, prazoParaCampos } from '../lib/prazo'
import { Subtarefas } from './Subtarefas'
import { codigoTarefa, ORDEM_STATUS, PRIORIDADE, STATUS, TIPO } from '../lib/rotulos'
import s from './Dialogo.module.css'

interface Props {
  tarefa: Tarefa
  onFechar: () => void
}

/** Dossiê da tarefa: edição completa e exclusão. Monte com key={tarefa.id}. */
export function EditorTarefa({ tarefa: t, onFechar }: Props) {
  const { areas, membros, atualizarTarefa, excluirTarefa } = useDados()
  const dialogo = useRef<HTMLDialogElement>(null)
  const inicial = prazoParaCampos(t.prazo, t.prazo_dia_inteiro)

  const [titulo, setTitulo] = useState(t.titulo)
  const [descricao, setDescricao] = useState(t.descricao ?? '')
  const [areaId, setAreaId] = useState(t.area_id ?? '')
  const [responsavelId, setResponsavelId] = useState(t.responsavel_id ?? '')
  const [tipo, setTipo] = useState<TarefaTipo>(t.tipo)
  const [status, setStatus] = useState<TarefaStatus>(t.status)
  const [prioridade, setPrioridade] = useState<TarefaPrioridade>(t.prioridade)
  const [data, setData] = useState(inicial.data)
  const [hora, setHora] = useState(inicial.hora)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)

  useEffect(() => {
    const d = dialogo.current
    if (d && !d.open) d.showModal()
    // showModal() foca o ×; a barra de espaço o acionaria. Foca a própria janela.
    d?.focus()
  }, [])

  function salvar(e: FormEvent) {
    e.preventDefault()
    const tituloLimpo = titulo.trim()
    if (!tituloLimpo) return
    void atualizarTarefa(t.id, {
      titulo: tituloLimpo,
      descricao: descricao.trim() || null,
      area_id: areaId || null,
      responsavel_id: responsavelId || null,
      tipo,
      status,
      prioridade,
      ...camposParaPrazo(data, hora),
      ...(status !== t.status ? { ordem: -Date.now() } : {}),
    })
    onFechar()
  }

  function excluir() {
    if (!confirmandoExclusao) return setConfirmandoExclusao(true)
    void excluirTarefa(t.id)
    onFechar()
  }

  return (
    <dialog
      ref={dialogo}
      className={s.dialogo}
      tabIndex={-1}
      onClose={onFechar}
      onClick={(e) => e.target === dialogo.current && dialogo.current?.close()}
      aria-labelledby="editor-titulo"
    >
      <form className={s.form} onSubmit={salvar}>
        <div className={s.topo}>
          <span className="mono" id="editor-titulo">DOSSIÊ {codigoTarefa(t.numero)}</span>
          <button type="button" className={s.fechar} aria-label="Fechar" onClick={() => dialogo.current?.close()}>
            ×
          </button>
        </div>

        <label className={s.campo}>
          <span className="sr">Título</span>
          <textarea className={s.titulo} rows={2} required value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </label>

        <fieldset className={s.status}>
          <legend className="sr">Status</legend>
          {ORDEM_STATUS.map((st) => (
            <label key={st} className={status === st ? s.statusAtivo : undefined} data-status={st}>
              <input type="radio" name="status" className="sr" checked={status === st} onChange={() => setStatus(st)} />
              {STATUS[st]}
            </label>
          ))}
        </fieldset>

        <div className={s.grade}>
          <label className={s.campo}>
            <span className="mono">ÁREA</span>
            <select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              <option value="">Sem área</option>
              {areas.filter((a) => !a.arquivada || a.id === t.area_id).map((a) => (
                <option key={a.id} value={a.id}>{a.nome}{a.arquivada ? ' (arquivada)' : ''}</option>
              ))}
            </select>
          </label>
          <label className={s.campo}>
            <span className="mono">RESPONSÁVEL</span>
            <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}>
              <option value="">Eu</option>
              {membros.filter((m) => m.ativo || m.id === t.responsavel_id).map((m) => (
                <option key={m.id} value={m.id}>{m.nome}{m.funcao ? ` — ${m.funcao}` : ''}{m.ativo ? '' : ' (afastado)'}</option>
              ))}
            </select>
          </label>
          <label className={s.campo}>
            <span className="mono">TIPO</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TarefaTipo)}>
              {Object.entries(TIPO).map(([v, r]) => (
                <option key={v} value={v}>{r}</option>
              ))}
            </select>
          </label>
          <label className={s.campo}>
            <span className="mono">PRIORIDADE</span>
            <select value={prioridade} onChange={(e) => setPrioridade(e.target.value as TarefaPrioridade)}>
              {Object.entries(PRIORIDADE).map(([v, r]) => (
                <option key={v} value={v}>{r}</option>
              ))}
            </select>
          </label>
          <div className={s.campo}>
            <span className="mono">PRAZO</span>
            <div className={s.prazo}>
              <input type="date" aria-label="Data do prazo" value={data} onChange={(e) => setData(e.target.value)} />
              <input type="time" aria-label="Hora do prazo (opcional)" value={hora} disabled={!data} onChange={(e) => setHora(e.target.value)} />
              {data && (
                <button type="button" className={s.limpar} aria-label="Remover prazo" onClick={() => { setData(''); setHora('') }}>
                  ×
                </button>
              )}
            </div>
          </div>
        </div>

        <label className={s.campo}>
          <span className="mono">NOTAS</span>
          <textarea rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Detalhes, links, observações…" />
        </label>

        <Subtarefas tarefaId={t.id} />

        <div className={s.acoes}>
          <button type="button" className={`btn ${confirmandoExclusao ? s.excluirConfirma : s.excluir}`} onClick={excluir}>
            {confirmandoExclusao ? 'Confirmar exclusão' : 'Excluir'}
          </button>
          <span className={s.espaco} />
          <button type="button" className="btn" onClick={() => dialogo.current?.close()}>Cancelar</button>
          <button type="submit" className="btn btn--destaque">Salvar</button>
        </div>
      </form>
    </dialog>
  )
}
