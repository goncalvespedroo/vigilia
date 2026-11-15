import { useEffect, useRef, useState } from 'react'
import { CapturaRapida } from './CapturaRapida'
import d from './Dialogo.module.css'

/** Janela de registro rápido, aberta pela barra lateral ou pela busca. */
export function NovaMissao({ onFechar }: { onFechar: () => void }) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [registradas, setRegistradas] = useState<string[]>([])

  useEffect(() => {
    const el = dialogo.current
    if (el && !el.open) el.showModal()
    // showModal() foca o ×; o foco precisa ir para o campo de registro.
    el?.querySelector('input')?.focus()
  }, [])

  const fechar = () => dialogo.current?.close()

  return (
    <dialog
      ref={dialogo}
      className={d.dialogo}
      onClose={onFechar}
      onClick={(e) => e.target === dialogo.current && fechar()}
      aria-labelledby="nova-missao-titulo"
    >
      <div className={d.cabecalho}>
        <div className={d.cabecalhoTexto}>
          <span className={d.sobretitulo}>NOVO REGISTRO</span>
          <h2 id="nova-missao-titulo" className={d.tituloJanela}>Nova missão</h2>
        </div>
        <button type="button" className={d.fechar} aria-label="Fechar" onClick={fechar}>×</button>
      </div>
      <div className={d.form}>
        <CapturaRapida autoFoco aoRegistrar={(t) => setRegistradas((r) => [t, ...r].slice(0, 3))} />
        {registradas.length > 0 && (
          <ul className={d.registradas} aria-live="polite">
            {registradas.map((t, i) => (
              <li key={`${i}-${t}`}>
                <span className="pulso" /> MISSÃO REGISTRADA · <b>{t}</b>
              </li>
            ))}
          </ul>
        )}
        <p className="mono" style={{ margin: 0 }}>ENTER REGISTRA E MANTÉM A JANELA ABERTA · ESC FECHA</p>
      </div>
    </dialog>
  )
}
