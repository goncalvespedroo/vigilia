import { useEffect, useRef, useState } from 'react'
import { linkWhatsApp } from '../lib/equipe'
import d from './Dialogo.module.css'
import s from './Cobranca.module.css'

interface Props {
  titulo: string
  textoInicial: string
  /** Com telefone, abre a conversa direto; sem, o WhatsApp pede para escolher o contato/grupo. */
  telefone: string | null
  onFechar: () => void
}

/** Prévia editável da mensagem de cobrança, com envio pelo WhatsApp ou cópia. */
export function Cobranca({ titulo, textoInicial, telefone, onFechar }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [texto, setTexto] = useState(textoInicial)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    const el = dialogo.current
    if (el && !el.open) el.showModal()
    el?.focus()
  }, [])

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2500)
    } catch {
      setCopiado(false)
    }
  }

  return (
    <dialog ref={dialogo} className={d.dialogo} tabIndex={-1} onClose={onFechar} onClick={(e) => e.target === dialogo.current && dialogo.current?.close()} aria-labelledby="cob-titulo">
      <div className={d.form}>
        <div className={d.topo}>
          <span className="mono" id="cob-titulo">{titulo}</span>
          <button type="button" className={d.fechar} aria-label="Fechar" onClick={() => dialogo.current?.close()}>×</button>
        </div>
        <label className={d.campo}>
          <span className="mono">MENSAGEM (EDITÁVEL)</span>
          <textarea className={s.texto} rows={10} value={texto} onChange={(e) => setTexto(e.target.value)} />
        </label>
        <div className={d.acoes}>
          <span className={d.espaco} />
          <button type="button" className="btn" onClick={copiar}>{copiado ? 'Copiado ✓' : 'Copiar'}</button>
          <a className={`btn btn--destaque ${s.whats}`} href={linkWhatsApp(telefone, texto)} target="_blank" rel="noopener noreferrer">
            {telefone ? 'Abrir conversa no WhatsApp' : 'Enviar pelo WhatsApp'}
          </a>
        </div>
      </div>
    </dialog>
  )
}
