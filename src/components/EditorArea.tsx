import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Area } from '../types/database'
import { useDados } from '../lib/dados'
import d from './Dialogo.module.css'
import s from './EditorArea.module.css'

export const CORES = ['#E5484D', '#E2A336', '#7CF08A', '#2DD4BF', '#8AB4F8', '#C084FC', '#F472B6', '#ECE7DC']

interface Props {
  /** Ausente = nova operação. Monte com key para reiniciar o formulário. */
  area?: Area
  onFechar: () => void
  onCriada?: (id: string) => void
}

function proximoCodigo(areas: Area[]) {
  const nums = areas.map((a) => Number(a.codigo?.match(/(\d+)$/)?.[1] ?? 0))
  return `OP-${String(Math.max(0, ...nums) + 1).padStart(4, '0')}`
}

export function EditorArea({ area, onFechar, onCriada }: Props) {
  const { areas, tarefas, criarArea, atualizarArea, excluirArea } = useDados()
  const dialogo = useRef<HTMLDialogElement>(null)
  const campoNome = useRef<HTMLInputElement>(null)
  const nova = !area

  const [nome, setNome] = useState(area?.nome ?? '')
  const [codigo, setCodigo] = useState(area?.codigo ?? proximoCodigo(areas))
  const [cor, setCor] = useState(area?.cor ?? CORES[areas.length % CORES.length]!)
  const [arquivada, setArquivada] = useState(area?.arquivada ?? false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const daArea = area ? tarefas.filter((t) => t.area_id === area.id) : []
  const pendentes = daArea.filter((t) => t.status !== 'feito').length

  useEffect(() => {
    const el = dialogo.current
    if (el && !el.open) el.showModal()
    // showModal() foca o primeiro botão (×); o foco precisa ir para o nome.
    if (nova) campoNome.current?.focus()
  }, [nova])

  const fechar = () => dialogo.current?.close()

  async function salvar(e: FormEvent) {
    e.preventDefault()
    const dados = { nome: nome.trim(), codigo: codigo.trim().toUpperCase() || null, cor, arquivada }
    if (!dados.nome) return setErro('Dê um nome à operação.')
    if (dados.nome.length > 60) return setErro('O nome pode ter no máximo 60 caracteres.')
    if (dados.codigo && !/^[A-Z0-9-]{1,12}$/.test(dados.codigo)) {
      return setErro('Código inválido: use só letras, números e hífen (até 12).')
    }
    setSalvando(true)
    setErro(null)
    try {
      if (nova) {
        const r = await criarArea(dados)
        if ('erro' in r) return setErro(r.erro)
        onCriada?.(r.id)
      } else {
        const falha = await atualizarArea(area.id, dados)
        if (falha) return setErro(falha)
      }
      fechar()
    } catch (e) {
      console.error('[Vigília] EditorArea', e)
      setErro(e instanceof Error ? e.message : 'Falha inesperada.')
    } finally {
      setSalvando(false)
    }
  }

  function excluir() {
    if (!area) return
    if (!confirmandoExclusao) return setConfirmandoExclusao(true)
    void excluirArea(area.id)
    fechar()
  }

  return (
    <dialog
      ref={dialogo}
      className={d.dialogo}
      onClose={onFechar}
      onClick={(e) => e.target === dialogo.current && fechar()}
      aria-labelledby="area-titulo"
    >
      <form className={d.form} onSubmit={salvar} noValidate>
        <div className={d.topo}>
          <span className="mono" id="area-titulo">
            {nova ? '// NOVA OPERAÇÃO' : `// OPERAÇÃO ${area.codigo ?? ''}`}
          </span>
          <button type="button" className={d.fechar} aria-label="Fechar" onClick={fechar}>×</button>
        </div>

        <label className={d.campo}>
          <span className="mono">NOME</span>
          <input
            ref={campoNome}
            className={s.nome}
            maxLength={60}
            placeholder="Ex.: Estágio, Iniciação científica…"
            value={nome}
            onChange={(e) => {
              setNome(e.target.value)
              setErro(null)
            }}
          />
        </label>

        <div className={d.grade}>
          <label className={d.campo}>
            <span className="mono">CÓDIGO</span>
            <input
              value={codigo}
              maxLength={12}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              style={{ fontFamily: 'var(--f-mono)' }}
            />
          </label>
          <fieldset className={`${d.campo} ${s.cores}`}>
            <legend className="mono">COR</legend>
            <div className={s.paleta}>
              {CORES.map((c) => (
                <label key={c} className={s.amostra} style={{ background: c }} data-ativa={cor === c || undefined}>
                  <input type="radio" name="cor" className="sr" checked={cor === c} onChange={() => setCor(c)} aria-label={`Cor ${c}`} />
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        {!nova && (
          <label className={s.arquivar}>
            <input type="checkbox" checked={arquivada} onChange={(e) => setArquivada(e.target.checked)} />
            <span>
              <strong>Arquivar operação</strong>
              <span className={s.ajuda}>Some dos filtros e do registro rápido. As tarefas continuam guardadas.</span>
            </span>
          </label>
        )}

        {!nova && (
          <p className="mono" style={{ margin: 0 }}>
            {daArea.length} {daArea.length === 1 ? 'TAREFA' : 'TAREFAS'} · {pendentes} {pendentes === 1 ? 'PENDENTE' : 'PENDENTES'}
          </p>
        )}

        {erro && (
          <p role="alert" className={s.alerta}>
            {erro}
          </p>
        )}

        {confirmandoExclusao && (
          <p className={s.alerta}>
            Excluir “{area?.nome}” é definitivo.{' '}
            {daArea.length > 0
              ? `${daArea.length === 1 ? 'A tarefa dela ficará' : `As ${daArea.length} tarefas dela ficarão`} sem área — nenhuma tarefa é apagada.`
              : 'Ela não tem tarefas.'}
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
          <button type="submit" className="btn btn--destaque" disabled={salvando}>
            {salvando ? 'Transmitindo…' : nova ? 'Criar operação' : 'Salvar'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
