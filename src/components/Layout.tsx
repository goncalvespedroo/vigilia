import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { Notificacoes } from './Notificacoes'
import { Busca } from './Busca'
import { NovaMissao } from './NovaMissao'
import { EditorTarefa } from './EditorTarefa'
import { sincronizarPush } from '../lib/push'
import { nomeDoAgente, useAuth } from '../lib/auth'
import { useDados } from '../lib/dados'
import { CentralContexto, type Central } from '../lib/central'
import { situacaoEntrega } from '../lib/equipe'
import { Emblema } from './Emblema'
import { SECOES, type Secao } from './secoes'
import s from './Layout.module.css'

function Icone({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true" className={s.icone}>
      <path d={d} />
    </svg>
  )
}

const hhmm = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export function Layout() {
  const { usuario, sair } = useAuth()
  const nome = nomeDoAgente(usuario)
  const { sincronia, semRede, ultimaSincronia, tarefas } = useDados()
  const estado = semRede ? 'semrede' : sincronia
  const { pathname } = useLocation()

  const [alertasAbertos, setAlertasAbertos] = useState(false)
  const [buscaAberta, setBuscaAberta] = useState(false)
  const [novaAberta, setNovaAberta] = useState(false)
  const [tarefaAberta, setTarefaAberta] = useState<string | null>(null)

  // Se o push já está ativo, mantém o registro deste dispositivo em dia.
  useEffect(() => {
    void sincronizarPush()
  }, [])

  // Ctrl K (ou /) abre a busca de qualquer tela.
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      const ctrlK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'
      const barra = e.key === '/' && !(e.target as HTMLElement).closest('input, textarea, select, [contenteditable], dialog[open]')
      if (!ctrlK && !barra) return
      if (document.querySelector('dialog[open]') && !ctrlK) return
      e.preventDefault()
      setBuscaAberta(true)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [])

  const central = useMemo<Central>(
    () => ({
      abrirTarefa: (id) => setTarefaAberta(id),
      abrirBusca: () => setBuscaAberta(true),
      novaMissao: () => setNovaAberta(true),
    }),
    [],
  )

  // Agentes com alguma entrega atrasada (selo vermelho na navegação).
  const agentesAtrasados = useMemo(() => {
    const agora = new Date()
    return new Set(tarefas.filter((t) => t.responsavel_id && situacaoEntrega(t, agora) === 'atrasado').map((t) => t.responsavel_id)).size
  }, [tarefas])

  const secaoAtual = SECOES.find((x) => (x.para === '/' ? pathname === '/' : pathname.startsWith(x.para)))
  const subtitulo = /^\/reunioes\/.+/.test(pathname) ? 'DOSSIÊ' : null
  const emEdicao = tarefaAberta ? tarefas.find((t) => t.id === tarefaAberta) : undefined
  const fecharEditor = useCallback(() => setTarefaAberta(null), [])

  const link = (sec: Secao, movel = false) => (
    <NavLink
      key={sec.para}
      to={sec.para}
      end={sec.para === '/'}
      className={({ isActive }) => `${movel ? s.linkMovel : s.link} ${isActive ? s.ativo : ''}`}
      title={sec.rotulo}
    >
      <Icone d={sec.icone} />
      <span className={s.rotulo}>{sec.rotulo}</span>
      {sec.para === '/agentes' && agentesAtrasados > 0 && (
        <span className={s.contador} aria-label={`${agentesAtrasados} com entrega atrasada`}>
          {agentesAtrasados}
        </span>
      )}
      {!movel && <span className={s.farol} aria-hidden="true" />}
    </NavLink>
  )

  return (
    <CentralContexto.Provider value={central}>
      <div className={s.casca}>
        <aside className={s.lateral}>
          <div className={s.marca}>
            <Emblema />
            <div className={s.marcaTexto}>
              <span className={s.nome}>VIGÍLIA</span>
              <span className={s.sub}>ARQUIVO CENTRAL</span>
            </div>
          </div>

          <button className={`btn btn--destaque ${s.nova}`} onClick={() => setNovaAberta(true)} title="Nova missão (N)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className={s.rotulo}>Nova missão</span>
          </button>

          <nav aria-label="Principal" className={s.nav}>
            <span className={s.grupo}>CENTRAL</span>
            {SECOES.filter((x) => x.grupo === 'central').map((x) => link(x))}
            <span className={s.grupo}>EQUIPE E RECURSOS</span>
            {SECOES.filter((x) => x.grupo === 'equipe').map((x) => link(x))}
          </nav>

          <div className={s.canal} data-estado={estado} role="status">
            <span className={s.canalLinha}>
              <span className={`pulso ${estado === 'online' ? '' : 'pulso--piscando'}`} />
              <span className={s.rotulo}>
                {estado === 'semrede' ? 'CANAL INTERROMPIDO' : estado === 'online' ? 'CANAL SEGURO' : 'RECONECTANDO…'}
              </span>
            </span>
            <span className={s.rotulo}>
              {ultimaSincronia ? `SINCRONIZADO · ${hhmm(ultimaSincronia)}` : 'AGUARDANDO SINAL'}
            </span>
          </div>
        </aside>

        <div className={s.coluna}>
          <header className={s.cabecalho}>
            <div className={s.marcaMovel}>
              <Emblema tamanho={32} />
              <span className={s.nome}>VIGÍLIA</span>
            </div>
            <span className={s.trilha}>
              ARQUIVO CENTRAL <span className={s.barra}>/</span>{' '}
              <span className={subtitulo ? undefined : s.trilhaAtual}>{(secaoAtual?.rotulo ?? 'Painel').toUpperCase()}</span>
              {subtitulo && (
                <>
                  {' '}
                  <span className={s.barra}>/</span> <span className={s.trilhaAtual}>{subtitulo}</span>
                </>
              )}
            </span>

            <div className={s.lado}>
              <button className={`${s.quadrado} ${s.novaMovel}`} aria-label="Nova missão" onClick={() => setNovaAberta(true)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
              <button className={s.busca} onClick={() => setBuscaAberta(true)} aria-label="Buscar no arquivo (Ctrl K)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M16.5 16.5 21 21" />
                </svg>
                <span className={s.buscaTexto}>Buscar no arquivo…</span>
                <kbd className={s.atalho}>Ctrl K</kbd>
              </button>
              <button className={s.quadrado} aria-label="Notificações" onClick={() => setAlertasAbertos(true)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                  <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0" />
                </svg>
              </button>
              <div className={s.agente}>
                <div aria-hidden="true" className={s.avatar}>
                  {nome.charAt(0)}
                </div>
                <div className={s.agenteTexto}>
                  <span className={s.agenteNome}>Agente {nome}</span>
                  <button className={s.sair} onClick={sair}>
                    ENCERRAR SESSÃO
                  </button>
                </div>
              </div>
            </div>
          </header>

          {semRede && (
            <div role="status" className={s.offline}>
              <span className="mono" style={{ color: 'var(--danger-text)' }}>
                ○ CANAL INTERROMPIDO
              </span>
              <span>
                Modo somente leitura
                {ultimaSincronia &&
                  ` · dados de ${ultimaSincronia.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${hhmm(ultimaSincronia)}`}
                . Alterações voltam quando a conexão retornar.
              </span>
            </div>
          )}

          <main className={s.conteudo}>
            <Outlet />
          </main>

          <footer className={s.rodape}>
            <span>
              VIGÍLIA · SISTEMA DE OPERAÇÕES v{__VERSAO__} · BUILD {__BUILD__}
            </span>
            <span>TODAS AS AÇÕES SÃO REGISTRADAS NO ARQUIVO</span>
          </footer>
        </div>

        <nav aria-label="Navegação rápida" className={s.navMovel}>
          {SECOES.filter((x) => x.movel).map((x) => link(x, true))}
        </nav>

        {alertasAbertos && <Notificacoes onFechar={() => setAlertasAbertos(false)} />}
        {buscaAberta && <Busca onFechar={() => setBuscaAberta(false)} />}
        {novaAberta && <NovaMissao onFechar={() => setNovaAberta(false)} />}
        {emEdicao && <EditorTarefa key={emEdicao.id} tarefa={emEdicao} onFechar={fecharEditor} />}
      </div>
    </CentralContexto.Provider>
  )
}
