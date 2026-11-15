import { useEffect, useState } from 'react'

/** Data atual que se renova sozinha (padrão: a cada minuto), para prazos "ficarem atrasados" sem recarregar. */
export function useAgora(intervaloMs = 60_000) {
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setAgora(new Date()), intervaloMs)
    const aoVoltar = () => document.visibilityState === 'visible' && setAgora(new Date())
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [intervaloMs])
  return agora
}
