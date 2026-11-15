import { useEffect, useState } from 'react'
import { iniciarAtualizacao, versaoAnterior, VERSAO_ATUAL } from '../lib/atualizacao'
import styles from './AtualizacaoPWA.module.css'

// Lido uma vez por carga da página (fora do componente por causa do StrictMode).
const atualizadoAgora = versaoAnterior() !== null

/** Registra o service worker e avisa, de forma discreta, quando o sistema foi atualizado. */
export function AtualizacaoPWA() {
  const [aviso, setAviso] = useState<string | null>(
    atualizadoAgora ? `Sistema atualizado para a versão ${VERSAO_ATUAL}` : null,
  )

  useEffect(() => {
    iniciarAtualizacao(() => setAviso('Sistema pronto para operar offline'))
  }, [])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 8000)
    return () => clearTimeout(t)
  }, [aviso])

  if (!aviso) return null

  return (
    <div role="status" className={styles.aviso}>
      <span className={styles.selo}>▲ TRANSMISSÃO</span>
      <span>{aviso}</span>
      <button className={styles.fechar} aria-label="Dispensar aviso" onClick={() => setAviso(null)}>
        ×
      </button>
    </div>
  )
}
