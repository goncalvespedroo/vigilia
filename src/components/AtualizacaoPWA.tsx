import { useRegisterSW } from 'virtual:pwa-register/react'
import styles from './AtualizacaoPWA.module.css'

/** Registra o service worker e avisa quando há versão nova. */
export function AtualizacaoPWA() {
  const {
    needRefresh: [precisaAtualizar, setPrecisaAtualizar],
    offlineReady: [prontoOffline, setProntoOffline],
    updateServiceWorker,
  } = useRegisterSW()

  if (!precisaAtualizar && !prontoOffline) return null

  return (
    <div role="status" className={styles.aviso}>
      <span>
        {precisaAtualizar ? 'Nova versão do sistema disponível.' : 'Sistema pronto para operar offline.'}
      </span>
      {precisaAtualizar && (
        <button className="btn btn--destaque" onClick={() => updateServiceWorker(true)}>
          Atualizar
        </button>
      )}
      <button
        className="btn"
        onClick={() => {
          setPrecisaAtualizar(false)
          setProntoOffline(false)
        }}
      >
        Dispensar
      </button>
    </div>
  )
}
