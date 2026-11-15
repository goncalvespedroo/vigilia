import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../lib/auth'

export function RotaProtegida() {
  const { sessao, carregando } = useAuth()
  const local = useLocation()

  if (carregando) {
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
        <span className="mono">VERIFICANDO CREDENCIAIS…</span>
      </div>
    )
  }
  if (!sessao) return <Navigate to="/entrar" replace state={{ de: local.pathname }} />
  return <Outlet />
}
