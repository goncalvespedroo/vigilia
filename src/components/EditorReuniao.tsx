import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Reuniao } from '../types/database'
import { useDados } from '../lib/dados'
import { hora } from '../lib/reunioes'
import { somarDias } from '../lib/prazo'
import d from './Dialogo.module.css'
import s from './EditorArea.module.css'

interface Props {
  reuniao?: Reuniao // ausente = nova convocação
  onFechar: () => void
  onCriada?: (id: string) => void
  onExcluida?: () => void
}

const dd = (n: number) => String(n).padStart(2, '0')
const paraData = (x: Date) => `${x.getFullYear()}-${dd(x.getMonth() + 1)}-${dd(x.getDate())}`
function juntar(data: string, h: string) {
  const [a = 0, m = 1, dia = 1] = data.split('-').map(Number)
  const [hh = 0, mm = 0] = h.split(':').map(Number)
  return new Date(a, m - 1, dia, hh, mm).toISOString()
}

export function EditorReuniao({ reuniao: r, onFechar, onCriada, onExcluida }: Props) {
  const { areas, participantes, itensPauta, criarReuniao, atualizarReuniao, excluirReuniao } = useDados()
  const dialogo = useRef<HTMLDialogElement>(null)
  const campoTitulo = useRef<HTMLInputElement>(null)
  const nova = !r

  const amanha = somarDias(new Date(), 1)
  const [titulo, setTitulo] = useState(r?.titulo ?? '')
  const [data, setData] = useState(r ? paraData(new Date(r.inicio)) : paraData(amanha))
  const [inicio, setInicio] = useState(r ? hora(r.inicio) : '19:00')
  const [fim, setFim] = useState(r?.fim ? hora(r.fim) : nova ? '20:00' : '')
  const [local, setLocal] = useState(r?.local ?? '')
  const [areaId, setAreaId] = useState(r?.area_id ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)

  useEffect(() => {
    const el = dialogo.current
    if (el && !el.open) el.showModal()
    if (nova) campoTitulo.current?.focus()
    else el?.focus()
  }, [nova])

  const fechar = () => dialogo.current?.close()

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!titulo.trim()) return setErro('Dê um título à reunião.')
    if (!data || !inicio) return setErro('Informe data e hora de início.')
    if (fim && fim <= inicio) return setErro('O horário de término precisa ser depois do início.')
    const dados = {
      titulo: titulo.trim(),
      inicio: juntar(data, inicio),
      fim: fim ? juntar(data, fim) : null,
      local: local.trim() || null,
      area_id: areaId || null,
    }
    setSalvando(true)
    setErro(null)
    try {
      if (nova) {
        const res = await criarReuniao(dados)
        if ('erro' in res) return setErro(res.erro)
        onCriada?.(res.id)
      } else {
        const falha = await atualizarReuniao(r.id, dados)
        if (falha) return setErro(falha)
      }
      fechar()
    } finally {
      setSalvando(false)
    }
  }

  function excluir() {
    if (!r) return
    if (!confirmandoExclusao) return setConfirmandoExclusao(true)
    void excluirReuniao(r.id)
    onExcluida?.()
    fechar()
  }

  const nItens = r ? itensPauta.filter((i) => i.reuniao_id === r.id).length : 0
  const nConv = r ? participantes.filter((p) => p.reuniao_id === r.id).length : 0

  return (
    <dialog ref={dialogo} className={d.dialogo} tabIndex={-1} onClose={onFechar} onClick={(e) => e.target === dialogo.current && fechar()} aria-labelledby="reuniao-titulo">
      <form className={d.form} onSubmit={salvar} noValidate>
        <div className={d.topo}>
          <span className="mono" id="reuniao-titulo">{nova ? 'NOVA CONVOCAÇÃO' : 'EDITAR CONVOCAÇÃO'}</span>
          <button type="button" className={d.fechar} aria-label="Fechar" onClick={fechar}>×</button>
        </div>

        <label className={d.campo}>
          <span className="mono">TÍTULO</span>
          <input ref={campoTitulo} className={s.nome} maxLength={200} placeholder="Ex.: Reunião de pauta — Equipe de Comunicação" value={titulo} onChange={(e) => { setTitulo(e.target.value); setErro(null) }} />
        </label>

        <div className={d.grade}>
          <label className={d.campo}>
            <span className="mono">DATA</span>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <div className={d.campo}>
            <span className="mono">HORÁRIO</span>
            <div className={d.prazo}>
              <input type="time" aria-label="Início" value={inicio} onChange={(e) => setInicio(e.target.value)} />
              <input type="time" aria-label="Término (opcional)" value={fim} onChange={(e) => setFim(e.target.value)} />
            </div>
          </div>
          <label className={d.campo}>
            <span className="mono">LOCAL OU LINK</span>
            <input maxLength={300} placeholder="Sala 3 ou https://meet…" value={local} onChange={(e) => setLocal(e.target.value)} />
          </label>
          <label className={d.campo}>
            <span className="mono">OPERAÇÃO</span>
            <select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              <option value="">Nenhuma</option>
              {areas.filter((a) => !a.arquivada || a.id === r?.area_id).map((a) => (
                <option key={a.id} value={a.id}>{a.nome}</option>
              ))}
            </select>
          </label>
        </div>

        {erro && <p role="alert" className={s.alerta}>{erro}</p>}
        {confirmandoExclusao && (
          <p className={s.alerta}>
            Excluir “{r?.titulo}” apaga a pauta ({nItens} {nItens === 1 ? 'item' : 'itens'}), os convocados ({nConv}) e a ata. Os encaminhamentos continuam como tarefas.
          </p>
        )}

        <div className={d.acoes}>
          {!nova && (
            <button type="button" className={`btn ${confirmandoExclusao ? d.excluirConfirma : d.excluir}`} onClick={excluir}>
              {confirmandoExclusao ? 'Confirmar exclusão' : 'Excluir'}
            </button>
          )}
          <span className={d.espaco} />
          <button type="button" className="btn" onClick={fechar}>Cancelar</button>
          <button type="submit" className="btn btn--destaque" disabled={salvando}>{salvando ? 'Transmitindo…' : nova ? 'Convocar' : 'Salvar'}</button>
        </div>
      </form>
    </dialog>
  )
}
