import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { Notificacoes } from './Notificacoes'
import { sincronizarPush } from '../lib/push'
import { nomeDoAgente, useAuth } from '../lib/auth'
import { useDados } from '../lib/dados'
import { Emblema } from './Emblema'
import s from './Layout.module.css'

const SECOES = [
  { para: '/', rotulo: 'Painel', icone: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z' },
  { para: '/hoje', rotulo: 'Hoje', icone: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z' },
  { para: '/operacoes', rotulo: 'Operações', icone: 'M4 6h16M4 12h16M4 18h10' },
  { para: '/reunioes', rotulo: 'Reuniões', icone: 'M4 5h16v15H4zM4 10h16M9 3v4M15 3v4' },
  { para: '/agentes', rotulo: 'Agentes', icone: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a7 7 0 0 1 14 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a7 7 0 0 0-4-6.3' },
] as const

export function Layout() {
  const { usuario, sair } = useAuth()
  const nome = nomeDoAgente(usuario)
  const { sincronia, semRede, ultimaSincronia } = useDados()
  const estado = semRede ? 'semrede' : sincronia
  const [alertasAbertos, setAlertasAbertos] = useState(false)

  // Se o push já está ativo, mantém o registro deste dispositivo em dia.
  useEffect(() => {
    void sincronizarPush()
  }, [])

  return (
    <div className={s.casca}>
      <header className={s.cabecalho}>
        <div className={s.marca}>
          <Emblema />
          <div className={s.marcaTexto}>
            <span className={s.nome}>VIGÍLIA</span>
            <span className="mono">SISTEMA DE OPERAÇÕES</span>
          </div>
        </div>

        <nav aria-label="Principal" className={s.nav}>
          {SECOES.map((sec) => (
            <NavLink key={sec.para} to={sec.para} end={sec.para === '/'} className={({ isActive }) => (isActive ? `${s.link} ${s.ativo}` : s.link)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className={s.icone}>
                <path d={sec.icone} />
              </svg>
              <span>{sec.rotulo}</span>
            </NavLink>
          ))}
        </nav>

        <div className={s.lado}>
        <button className={s.sino} aria-label="Notificações" onClick={() => setAlertasAbertos(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        </button>
        <div className={s.agente}>
          <div aria-hidden="true" className={s.avatar}>{nome.charAt(0)}</div>
          <div className={s.agenteTexto}>
            <span className={s.agenteNome}>Agente {nome}</span>
            <button className={s.sair} onClick={sair}>ENCERRAR SESSÃO</button>
          </div>
        </div>
        </div>
      </header>

      {semRede && (
        <div role="status" className={s.offline}>
          <span className="mono" style={{ color: 'var(--c-destaque)' }}>○ CANAL INTERROMPIDO</span>
          <span>
            Modo somente leitura
            {ultimaSincronia &&
              ` · dados de ${ultimaSincronia.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${ultimaSincronia.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
            . Alterações voltam quando a conexão retornar.
          </span>
        </div>
      )}

      <main className={s.conteudo}>
        <Outlet />
      </main>

      <footer className={s.rodape}>
        <span>VIGÍLIA v{__VERSAO__} · BUILD {__BUILD__} · USO RESTRITO</span>
        <span className={s.sincronia} data-estado={estado}>
          {estado === 'semrede'
            ? '○ CANAL INTERROMPIDO'
            : estado === 'online'
              ? '● SINCRONIZADO'
              : estado === 'offline'
                ? '◌ TEMPO REAL RECONECTANDO…'
                : '◌ CONECTANDO…'}
        </span>
      </footer>

      {alertasAbertos && <Notificacoes onFechar={() => setAlertasAbertos(false)} />}
    </div>
  )
}
