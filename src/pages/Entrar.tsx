import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../lib/auth'
import { Emblema } from '../components/Emblema'
import s from './Entrar.module.css'

export function Entrar() {
  const { sessao, entrar } = useAuth()
  const local = useLocation()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const destino = (local.state as { de?: string } | null)?.de ?? '/'
  if (sessao) return <Navigate to={destino} replace />

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro(await entrar(email, senha))
    setEnviando(false)
  }

  return (
    <div className={s.tela}>
      <form className={`card ${s.cartao}`} onSubmit={enviar}>
        <div className={s.topo}>
          <Emblema tamanho={48} />
          <span className="carimbo">ACESSO RESTRITO</span>
        </div>
        <div className={s.cabeca}>
          <span className="mono">CANAL SEGURO · IDENTIFICAÇÃO</span>
          <h1 className={s.titulo}>Identifique-se, agente.</h1>
        </div>

        <label className={s.campo}>
          <span className="mono">E-MAIL</span>
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className={s.campo}>
          <span className="mono">SENHA</span>
          <input type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
        </label>

        {erro && <p role="alert" className={s.erro}>{erro}</p>}

        <button type="submit" className="btn btn--destaque" disabled={enviando}>
          {enviando ? 'Verificando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
