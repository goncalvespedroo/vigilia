import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { limparCache } from './cache'

interface AuthCtx {
  sessao: Session | null
  usuario: User | null
  carregando: boolean
  entrar: (email: string, senha: string) => Promise<string | null>
  sair: () => Promise<void>
  /** Grava o codinome (nome de exibição) na conta; vale em todos os dispositivos. */
  renomear: (nome: string) => Promise<string | null>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    // getSession lê do armazenamento local: funciona offline com sessão salva.
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session)
      setCarregando(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSessao(s))
    return () => data.subscription.unsubscribe()
  }, [])

  async function entrar(email: string, senha: string) {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
    return error ? traduzirErro(error.message, error.status) : null
  }

  async function sair() {
    limparCache()
    // scope 'local': encerra neste dispositivo mesmo sem internet.
    await supabase.auth.signOut({ scope: 'local' })
  }

  async function renomear(nome: string) {
    const limpo = nome.trim().replace(/\s+/g, ' ')
    if (!limpo) return 'Informe um codinome.'
    if (limpo.length > 40) return 'Use no máximo 40 caracteres.'
    const { data, error } = await supabase.auth.updateUser({ data: { nome: limpo } })
    if (error) return navigator.onLine ? 'Não foi possível salvar o codinome.' : 'Sem conexão: tente quando o canal voltar.'
    if (data.user) setSessao((s) => (s ? { ...s, user: data.user } : s))
    return null
  }

  return (
    <Ctx.Provider value={{ sessao, usuario: sessao?.user ?? null, carregando, entrar, sair, renomear }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}

/** Nome de exibição: metadado "nome" ou a parte antes do @, capitalizada. */
export function nomeDoAgente(u: User | null) {
  const meta = u?.user_metadata?.nome as string | undefined
  if (meta) return meta
  const base = u?.email?.split('@')[0]?.split(/[._-]/)[0] ?? 'Agente'
  return base.charAt(0).toUpperCase() + base.slice(1)
}

function traduzirErro(msg: string, status?: number) {
  if (/invalid login credentials/i.test(msg)) return 'Credenciais inválidas. Verifique e-mail e senha.'
  if (/email not confirmed/i.test(msg)) return 'E-mail ainda não confirmado.'
  if (status === 429 || /rate limit/i.test(msg)) return 'Muitas tentativas. Aguarde alguns minutos.'
  if (/fetch|network/i.test(msg)) return 'Sem conexão com a central. Verifique a internet.'
  return `Falha na autenticação: ${msg}`
}
