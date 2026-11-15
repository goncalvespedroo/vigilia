import { Component, type ErrorInfo, type ReactNode } from 'react'

/** Limpa tudo que fica guardado no navegador (cache local, service worker, caches) e recarrega. */
export async function limparTudoERecarregar() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith('vigilia.')).forEach((k) => localStorage.removeItem(k))
  } catch { /* sem armazenamento */ }
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations()) ?? []
    await Promise.all(regs.map((r) => r.unregister()))
  } catch { /* sem service worker */ }
  try {
    const nomes = (await caches?.keys()) ?? []
    await Promise.all(nomes.map((n) => caches.delete(n)))
  } catch { /* sem Cache API */ }
  location.reload()
}

export function TelaFalha({ erro }: { erro: unknown }) {
  const e = erro instanceof Error ? erro : new Error(String(erro))
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div className="card" style={{ maxWidth: 640, width: '100%', display: 'flex', flexDirection: 'column', gap: 14, borderColor: 'var(--danger)' }}>
        <span className="mono" style={{ color: 'var(--danger-text)' }}>FALHA NO SISTEMA</span>
        <h1 style={{ margin: 0, fontSize: 24 }}>Algo quebrou ao montar a tela.</h1>
        <p style={{ margin: 0, color: 'var(--text-2)', lineHeight: 1.5 }}>
          Copie o texto abaixo e envie para análise. Se o problema persistir, use “Limpar dados locais” — seus dados no
          servidor não são afetados.
        </p>
        <pre style={{ margin: 0, padding: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, fontFamily: 'var(--f-mono)', fontSize: 12, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 260, overflow: 'auto' }}>
          {`${e.name}: ${e.message}\n\n${e.stack ?? ''}\n\nBUILD ${__BUILD__} · ${location.pathname}`}
        </pre>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button className="btn btn--destaque" onClick={() => location.reload()}>Recarregar</button>
          <button className="btn" onClick={() => void limparTudoERecarregar()}>Limpar dados locais e recarregar</button>
        </div>
      </div>
    </div>
  )
}

/** Captura erros de renderização: em vez de tela em branco, mostra o erro. */
export class LimiteDeFalha extends Component<{ children: ReactNode }, { erro: unknown }> {
  state = { erro: null as unknown }
  static getDerivedStateFromError(erro: unknown) {
    return { erro }
  }
  componentDidCatch(erro: unknown, info: ErrorInfo) {
    console.error('[Vigília] falha de renderização', erro, info.componentStack)
  }
  render() {
    return this.state.erro ? <TelaFalha erro={this.state.erro} /> : this.props.children
  }
}
