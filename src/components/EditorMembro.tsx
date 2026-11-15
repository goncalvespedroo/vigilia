import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Membro } from '../types/database'
import { useDados } from '../lib/dados'
import { formatarTelefone, normalizarTelefone } from '../lib/equipe'
import d from './Dialogo.module.css'
import s from './EditorArea.module.css'

interface Props {
  membro?: Membro // ausente = novo agente
  onFechar: () => void
}

export function EditorMembro({ membro, onFechar }: Props) {
  const { tarefas, criarMembro, atualizarMembro, excluirMembro } = useDados()
  const dialogo = useRef<HTMLDialogElement>(null)
  const campoNome = useRef<HTMLInputElement>(null)
  const novo = !membro

  const [nome, setNome] = useState(membro?.nome ?? '')
  const [funcao, setFuncao] = useState(membro?.funcao ?? '')
  const [telefone, setTelefone] = useState(membro?.telefone ? formatarTelefone(membro.telefone) : '')
  const [ativo, setAtivo] = useState(membro?.ativo ?? true)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)

  const entregas = membro ? tarefas.filter((t) => t.responsavel_id === membro.id) : []

  useEffect(() => {
    const el = dialogo.current
    if (el && !el.open) el.showModal()
    if (novo) campoNome.current?.focus()
    else el?.focus()
  }, [novo])

  const fechar = () => dialogo.current?.close()

  async function salvar(e: FormEvent) {
    e.preventDefault()
    const tel = normalizarTelefone(telefone)
    const dados = { nome: nome.trim(), funcao: funcao.trim() || null, telefone: tel, ativo }
    if (!dados.nome) return setErro('Informe o nome do agente.')
    if (tel && (tel.length < 10 || tel.length > 15)) return setErro('Telefone inválido. Use DDD + número, ex.: (83) 99999-0000.')
    setSalvando(true)
    setErro(null)
    try {
      if (novo) {
        const r = await criarMembro(dados)
        if ('erro' in r) return setErro(r.erro)
      } else {
        const falha = await atualizarMembro(membro.id, dados)
        if (falha) return setErro(falha)
      }
      fechar()
    } finally {
      setSalvando(false)
    }
  }

  function excluir() {
    if (!membro) return
    if (!confirmandoExclusao) return setConfirmandoExclusao(true)
    void excluirMembro(membro.id)
    fechar()
  }

  return (
    <dialog ref={dialogo} className={d.dialogo} tabIndex={-1} onClose={onFechar} onClick={(e) => e.target === dialogo.current && fechar()} aria-labelledby="membro-titulo">
      <form className={d.form} onSubmit={salvar} noValidate>
        <div className={d.topo}>
          <span className="mono" id="membro-titulo">{novo ? '// RECRUTAR AGENTE' : '// FICHA DO AGENTE'}</span>
          <button type="button" className={d.fechar} aria-label="Fechar" onClick={fechar}>×</button>
        </div>

        <label className={d.campo}>
          <span className="mono">NOME</span>
          <input ref={campoNome} className={s.nome} maxLength={60} placeholder="Ex.: Ana Souza" value={nome} onChange={(e) => { setNome(e.target.value); setErro(null) }} />
        </label>

        <div className={d.grade}>
          <label className={d.campo}>
            <span className="mono">FUNÇÃO</span>
            <input maxLength={40} placeholder="Design, Redação…" value={funcao} onChange={(e) => setFuncao(e.target.value)} />
          </label>
          <label className={d.campo}>
            <span className="mono">WHATSAPP (OPCIONAL)</span>
            <input type="tel" inputMode="tel" autoComplete="off" placeholder="(83) 99999-0000" value={telefone} onChange={(e) => { setTelefone(e.target.value); setErro(null) }} />
          </label>
        </div>

        {!novo && (
          <label className={s.arquivar}>
            <input type="checkbox" checked={!ativo} onChange={(e) => setAtivo(!e.target.checked)} />
            <span>
              <strong>Afastar agente</strong>
              <span className={s.ajuda}>Sai das listas de responsável e do +agente. O histórico de entregas fica guardado.</span>
            </span>
          </label>
        )}

        {erro && <p role="alert" className={s.alerta}>{erro}</p>}
        {confirmandoExclusao && (
          <p className={s.alerta}>
            Excluir “{membro?.nome}” é definitivo.{' '}
            {entregas.length ? `${entregas.length === 1 ? 'A entrega dele(a) volta' : `As ${entregas.length} entregas voltam`} para você (sem responsável).` : 'Não há entregas atribuídas.'}
          </p>
        )}

        <div className={d.acoes}>
          {!novo && (
            <button type="button" className={`btn ${confirmandoExclusao ? d.excluirConfirma : d.excluir}`} onClick={excluir}>
              {confirmandoExclusao ? 'Confirmar exclusão' : 'Excluir'}
            </button>
          )}
          <span className={d.espaco} />
          <button type="button" className="btn" onClick={fechar}>Cancelar</button>
          <button type="submit" className="btn btn--destaque" disabled={salvando}>{salvando ? 'Transmitindo…' : novo ? 'Recrutar' : 'Salvar'}</button>
        </div>
      </form>
    </dialog>
  )
}
