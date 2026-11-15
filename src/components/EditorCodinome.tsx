import { useEffect, useRef, useState, type FormEvent } from 'react'
import { nomeDoAgente, useAuth } from '../lib/auth'
import d from './Dialogo.module.css'

/** Troca o codinome exibido ("Agente …"). */
export function EditorCodinome({ onFechar }: { onFechar: () => void }) {
  const { usuario, renomear } = useAuth()
  const dialogo = useRef<HTMLDialogElement>(null)
  const [nome, setNome] = useState(nomeDoAgente(usuario))
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    const el = dialogo.current
    if (el && !el.open) el.showModal()
    el?.querySelector('input')?.select()
  }, [])

  const fechar = () => dialogo.current?.close()

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setSalvando(true)
    const falha = await renomear(nome)
    setSalvando(false)
    if (falha) setErro(falha)
    else fechar()
  }

  return (
    <dialog
      ref={dialogo}
      className={d.dialogo}
      style={{ width: 'min(420px, calc(100vw - 24px))' }}
      onClose={onFechar}
      onClick={(e) => e.target === dialogo.current && fechar()}
      aria-labelledby="codinome-titulo"
    >
      <form className={d.form} onSubmit={salvar} noValidate>
        <div className={d.topo}>
          <span className="mono" id="codinome-titulo">CODINOME DO AGENTE</span>
          <button type="button" className={d.fechar} aria-label="Fechar" onClick={fechar}>×</button>
        </div>
        <label className={d.campo}>
          <span>Como o sistema deve chamar você</span>
          <input value={nome} maxLength={40} autoComplete="nickname" onChange={(e) => { setNome(e.target.value); setErro(null) }} />
        </label>
        <p className="mono" style={{ margin: 0 }}>APARECE COMO “AGENTE {nome.trim().toUpperCase() || '…'}”</p>
        {erro && <p role="alert" style={{ margin: 0, color: 'var(--danger-text)', fontSize: 14 }}>{erro}</p>}
        <div className={d.acoes}>
          <span className={d.espaco} />
          <button type="button" className="btn" onClick={fechar}>Cancelar</button>
          <button type="submit" className="btn btn--destaque" disabled={salvando || !nome.trim()}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
