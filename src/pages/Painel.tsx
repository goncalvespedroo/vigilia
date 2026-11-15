import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import type { Area, Tarefa } from '../types/database'
import { nomeDoAgente, useAuth } from '../lib/auth'
import { useDados } from '../lib/dados'
import { diasEntre, formatarPrazo, inicioDoDia, situacao, somarDias } from '../lib/prazo'
import { useAgora } from '../lib/useAgora'
import { codigoTarefa, PESO_PRIORIDADE } from '../lib/rotulos'
import { EditorArea } from '../components/EditorArea'
import { EditorTarefa } from '../components/EditorTarefa'
import { CapturaRapida } from '../components/CapturaRapida'
import { LinhaTarefa } from '../components/Checklist'
import { Cobranca } from '../components/Cobranca'
import { diaCurto, horario, porVir } from '../lib/reunioes'
import { mensagemGrupo, ordenarEntregas, ROTULO_ENTREGA, situacaoEntrega } from '../lib/equipe'
import s from './Painel.module.css'

const DIAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
const CHAVE_FOCO = 'vigilia.foco'
const dd = (n: number) => String(n).padStart(2, '0')
const mesmoDia = (iso: string | null, d: Date) => !!iso && diasEntre(new Date(iso), d) === 0

function lerFoco() {
  try {
    return localStorage.getItem(CHAVE_FOCO)
  } catch {
    return null
  }
}

export function Painel() {
  const { usuario } = useAuth()
  const { areas, tarefas, membros, membroPorId, reunioes, participantes, carregando, erro, semRede } = useDados()
  const agora = useAgora()
  const navegar = useNavigate()
  const [criandoArea, setCriandoArea] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const [cobrando, setCobrando] = useState(false)
  const [focoEscolhido, setFocoEscolhido] = useState<string | null>(lerFoco)

  const ativas = areas.filter((a) => !a.arquivada)
  const arquivadas = areas.filter((a) => a.arquivada)
  const pendentes = tarefas.filter((t) => t.status !== 'feito')

  // Semana corrente, de segunda a domingo
  const segunda = somarDias(inicioDoDia(agora), -((agora.getDay() + 6) % 7))
  const fimSemana = somarDias(segunda, 7)
  const semana = Array.from({ length: 7 }, (_, i) => {
    const dia = somarDias(segunda, i)
    return {
      dia,
      rotulo: DIAS[dia.getDay()]!,
      hoje: diasEntre(dia, agora) === 0,
      concluidas: tarefas.filter((t) => t.status === 'feito' && mesmoDia(t.concluida_em, dia)).length,
      planejadas: tarefas.filter((t) => mesmoDia(t.prazo, dia)).length,
    }
  })
  const escala = Math.max(1, ...semana.map((d) => Math.max(d.concluidas, d.planejadas)))

  // Indicadores
  const criticas = pendentes.filter((t) => {
    const sit = situacao(t, agora)
    return sit === 'atrasada' || sit === 'hoje' || t.prioridade === 'maxima'
  })
  const encerradasSemana = tarefas.filter((t) => t.status === 'feito' && t.concluida_em && new Date(t.concluida_em) >= segunda).length
  const restantesSemana = pendentes.filter((t) => t.prazo && new Date(t.prazo) < fimSemana).length
  const progressoSemana = encerradasSemana + restantesSemana ? encerradasSemana / (encerradasSemana + restantesSemana) : 0
  const em48h = pendentes.filter((t) => t.prazo && new Date(t.prazo) >= agora && new Date(t.prazo).getTime() - agora.getTime() <= 48 * 3600_000).length

  // Distribuição das críticas por operação (mini-barras do indicador)
  const criticasPorArea = ativas.map((a) => criticas.filter((t) => t.area_id === a.id).length)

  // Operação em foco: a escolhida, ou a com mais pendências críticas/pendentes
  const foco = useMemo(() => {
    const escolhida = ativas.find((a) => a.id === focoEscolhido)
    if (escolhida) return escolhida
    const peso = (a: Area) =>
      criticas.filter((t) => t.area_id === a.id).length * 100 + pendentes.filter((t) => t.area_id === a.id).length
    return [...ativas].sort((a, b) => peso(b) - peso(a))[0]
  }, [ativas, focoEscolhido, criticas, pendentes])

  // Próxima convocação: a próxima reunião agendada; sem ela, uma tarefa do tipo reunião
  const proximaReuniao = reunioes.find((r) => porVir(r, agora))
  const convocados = proximaReuniao ? participantes.filter((p) => p.reuniao_id === proximaReuniao.id).length : 0
  const convocacao = pendentes
    .filter((t) => t.tipo === 'reuniao' && t.prazo && new Date(t.prazo).getTime() > agora.getTime() - 3600_000) // até 1h após o início
    .sort((a, b) => a.prazo!.localeCompare(b.prazo!))[0]

  // Diretrizes de hoje: tudo que vence hoje, concluído ou não
  const diretrizes = tarefas.filter((t) => mesmoDia(t.prazo, agora)).sort((a, b) => Number(a.status === 'feito') - Number(b.status === 'feito') || PESO_PRIORIDADE[a.prioridade] - PESO_PRIORIDADE[b.prioridade])
  const diretrizesFeitas = diretrizes.filter((t) => t.status === 'feito').length

  // Agentes em campo: pendentes com responsável + entregues nos últimos 3 dias
  const agentesAtivos = membros.filter((m) => m.ativo)
  const emCampo = tarefas
    .filter((t) => t.responsavel_id && membroPorId.get(t.responsavel_id)?.ativo)
    .filter((t) => t.status !== 'feito' || (t.concluida_em && agora.getTime() - new Date(t.concluida_em).getTime() < 3 * 86_400_000))
    .sort((a, b) => ordenarEntregas(a, b, agora))
    .slice(0, 6)

  const emEdicao = editando ? tarefas.find((t) => t.id === editando) : undefined
  const turno = `${dd(agora.getDate())}.${dd(agora.getMonth() + 1)}.${agora.getFullYear()} · ${dd(agora.getHours())}:${dd(agora.getMinutes())}`

  function escolherFoco(id: string) {
    setFocoEscolhido(id)
    try {
      localStorage.setItem(CHAVE_FOCO, id)
    } catch {
      /* sem armazenamento: vale só nesta sessão */
    }
  }

  return (
    <>
      <section className={s.saudacao}>
        <div className={s.saudacaoTexto}>
          <span className="mono">// TURNO {turno} · {semRede ? <span style={{ color: 'var(--c-destaque)' }}>CANAL INTERROMPIDO</span> : 'CANAL SEGURO'}</span>
          <h1 className={s.titulo}>Bem-vindo de volta, Agente {nomeDoAgente(usuario)}.</h1>
          <p className={s.sub}>
            {carregando
              ? 'A vigília continua.'
              : em48h
                ? `A vigília continua. Você tem ${em48h} ${em48h === 1 ? 'prazo' : 'prazos'} nas próximas 48 horas.`
                : 'A vigília continua. Nenhum prazo nas próximas 48 horas.'}
          </p>
        </div>
        <span className="carimbo">CONFIDENCIAL</span>
      </section>

      {erro && <p className={s.erro}>Falha ao consultar a central: {erro}</p>}

      <div className={s.grade}>
        <div className={s.principal}>
          {/* Indicadores */}
          <div className={s.indicadores}>
            <article className={`card ${s.indicador}`}>
              <div className={s.indTopo}>
                <h2>Missões ativas</h2>
                <Link to="/operacoes" className={s.seta} aria-label="Ver missões ativas"><Seta /></Link>
              </div>
              <div className={s.indCorpo}>
                <span className={s.numero}>{dd(pendentes.length)}</span>
                <div aria-hidden="true" className={s.hachura} />
              </div>
            </article>
            <article className={`card ${s.indicador}`}>
              <div className={s.indTopo}>
                <h2>Pendências críticas</h2>
                <Link to="/hoje" className={s.seta} aria-label="Ver pendências críticas"><Seta /></Link>
              </div>
              <div className={s.indCorpo}>
                <span className={s.numero} style={criticas.length ? { color: 'var(--c-destaque)' } : undefined}>{dd(criticas.length)}</span>
                <div aria-hidden="true" className={s.miniBarras}>
                  {criticasPorArea.map((n, i) => (
                    <div key={i} style={{ height: `${Math.max(12, (n / Math.max(1, ...criticasPorArea)) * 100)}%`, background: n ? ativas[i]!.cor ?? 'var(--c-destaque)' : 'var(--c-borda-forte)' }} />
                  ))}
                </div>
              </div>
            </article>
            <article className={`card ${s.indicador}`}>
              <div className={s.indTopo}>
                <h2>Encerradas na semana</h2>
                <Link to="/operacoes?v=checklist" className={s.seta} aria-label="Ver missões encerradas"><Seta /></Link>
              </div>
              <div className={s.indCorpo}>
                <span className={s.numero}>{dd(encerradasSemana)}</span>
                <div className={s.progresso} role="img" aria-label={`${Math.round(progressoSemana * 100)}% dos prazos da semana cumpridos`}>
                  <div style={{ width: `${progressoSemana * 100}%` }} />
                </div>
              </div>
            </article>
          </div>

          <div className={s.dupla}>
            {/* Registro semanal */}
            <article className={`card ${s.bloco}`}>
              <div className={s.blocoTopo}>
                <div className={s.blocoTitulo}>
                  <h2>Registro semanal</h2>
                  <span className="mono">CONCLUÍDAS / PLANEJADAS POR DIA</span>
                </div>
              </div>
              <div className={s.semana} role="img" aria-label={semana.map((d) => `${d.rotulo}: ${d.concluidas} de ${d.planejadas}`).join('; ')}>
                {semana.map((d) => (
                  <div key={d.rotulo} className={s.dia} data-hoje={d.hoje || undefined}>
                    <span className={s.diaNum}>{d.concluidas}/{d.planejadas}</span>
                    <div className={s.trilho}>
                      <div className={s.planejada} style={{ height: `${(d.planejadas / escala) * 100}%` }} />
                      <div className={s.concluida} style={{ height: `${(d.concluidas / escala) * 100}%` }} />
                    </div>
                    <span className="mono">{d.rotulo}</span>
                  </div>
                ))}
              </div>
            </article>

            {/* Operação em foco */}
            {foco ? <CartaoFoco area={foco} ativas={ativas} tarefas={tarefas} agora={agora} onEscolher={escolherFoco} onAbrir={setEditando} /> : null}
          </div>

          <div className={s.linhaEquipe}>
          {/* Agentes em campo */}
          <article className={`card ${s.bloco} ${s.agentes}`}>
            <div className={s.blocoTopo}>
              <div className={s.blocoTitulo}>
                <h2>Agentes em campo</h2>
                <span className="mono">EQUIPE · ENTREGAS POR PESSOA</span>
              </div>
              {agentesAtivos.length > 0 && (
                <button className="btn" onClick={() => setCobrando(true)}>Cobrar pendentes</button>
              )}
            </div>
            {agentesAtivos.length === 0 ? (
              <p className={s.sub}>Nenhum agente cadastrado. <Link to="/agentes" className={s.link}>Recrutar equipe →</Link></p>
            ) : emCampo.length === 0 ? (
              <p className={s.sub}>Nenhuma entrega atribuída. Use <code className="mono">+nome</code> no registro rápido.</p>
            ) : (
              <div className={s.tabelaRolagem}>
                <table className={s.tabela}>
                  <thead>
                    <tr><th>Agente</th><th>Entrega</th><th>Prazo</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {emCampo.map((t) => {
                      const m = membroPorId.get(t.responsavel_id!)!
                      const sit = situacaoEntrega(t, agora)
                      return (
                        <tr key={t.id} onClick={() => setEditando(t.id)}>
                          <td>
                            <div className={s.agenteCel}>
                              <div aria-hidden="true" className={s.avatarP}>{m.nome.charAt(0).toUpperCase()}</div>
                              <div className={s.agenteTxt}><span>{m.nome}</span><span className="mono">{(m.funcao ?? '').toUpperCase()}</span></div>
                            </div>
                          </td>
                          <td><button className={s.entregaBtn} onClick={(e) => { e.stopPropagation(); setEditando(t.id) }}>{t.titulo}</button></td>
                          <td className={s.prazoCel}>{t.prazo ? `${dd(new Date(t.prazo).getDate())}/${dd(new Date(t.prazo).getMonth() + 1)}` : '—'}</td>
                          <td><span className={s.pilula} data-sit={sit}>{ROTULO_ENTREGA[sit]}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          {/* Operações abertas */}
          <article className={`card ${s.areas} ${s.opsLado}`}>
            <div className={s.blocoTopo}>
              <h2 className={s.h2}>Operações abertas</h2>
              <button className={s.mais} aria-label="Nova operação" onClick={() => setCriandoArea(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              </button>
            </div>
            {carregando && <span className="mono">CARREGANDO…</span>}
            {!carregando && ativas.length === 0 && <p className={s.sub}>Nenhuma operação ativa.</p>}
            <div className={s.listaOps}>
              {ativas.map((a, i) => (
                <ItemOperacao key={a.id} area={a} indice={i} pendentes={pendentes.filter((t) => t.area_id === a.id).length} />
              ))}
            </div>
            {arquivadas.length > 0 && (
              <details className={s.arquivadas}>
                <summary className="mono">ARQUIVADAS ({arquivadas.length})</summary>
                <div className={s.listaOps}>
                  {arquivadas.map((a, i) => (
                    <ItemOperacao key={a.id} area={a} indice={i} pendentes={pendentes.filter((t) => t.area_id === a.id).length} />
                  ))}
                </div>
              </details>
            )}
          </article>
          </div>
        </div>

        <aside className={s.lateral}>
          {/* Próxima convocação */}
          <article className={`card ${s.bloco}`}>
            <h2 className={s.h2}>Próxima convocação</h2>
            {proximaReuniao ? (
              <div className={s.pilha}>
                <div aria-hidden="true" className={s.folha1} />
                <div aria-hidden="true" className={s.folha2} />
                <div className={s.convocacao}>
                  <span className="mono" style={{ color: 'var(--c-destaque)' }}>● CONVOCAÇÃO · {diaCurto(proximaReuniao.inicio, agora)}</span>
                  <span className={s.convTitulo}>{proximaReuniao.titulo}</span>
                  <span className="mono">
                    {horario(proximaReuniao)} · {convocados} {convocados === 1 ? 'agente convocado' : 'agentes convocados'}
                  </span>
                  <Link to={`/reunioes/${proximaReuniao.id}`} className={`btn btn--destaque ${s.convBotao}`}>
                    Abrir dossiê da reunião
                  </Link>
                </div>
              </div>
            ) : convocacao ? (
              <div className={s.pilha}>
                <div aria-hidden="true" className={s.folha1} />
                <div aria-hidden="true" className={s.folha2} />
                <div className={s.convocacao}>
                  <span className="mono" style={{ color: 'var(--c-destaque)' }}>
                    ● CONVOCAÇÃO · {formatarPrazo(convocacao.prazo!, true, agora)}
                  </span>
                  <span className={s.convTitulo}>{convocacao.titulo}</span>
                  <span className="mono">
                    {convocacao.prazo_dia_inteiro ? 'HORÁRIO A DEFINIR' : formatarPrazo(convocacao.prazo!, false, agora).split(' · ')[1]}
                  </span>
                  <button className={`btn btn--destaque ${s.convBotao}`} onClick={() => setEditando(convocacao.id)}>
                    Abrir dossiê da reunião
                  </button>
                </div>
              </div>
            ) : (
              <p className={s.sub}>Nenhuma convocação agendada. <Link to="/reunioes" className={s.link}>Convocar reunião →</Link></p>
            )}
          </article>

          {/* Diretrizes de hoje */}
          <article className={`card ${s.bloco}`}>
            <div className={s.blocoTopo}>
              <h2 className={s.h2}>Diretrizes de hoje</h2>
              <span className="mono">{diretrizesFeitas} / {diretrizes.length}</span>
            </div>
            <div>
              {diretrizes.length === 0 && <p className={s.sub}>Nada vence hoje.</p>}
              {diretrizes.map((t) => <LinhaTarefa key={t.id} t={t} onAbrir={setEditando} />)}
            </div>
            <CapturaRapida paraHoje compacta />
          </article>
        </aside>
      </div>

      {cobrando && (
        <Cobranca
          titulo="COBRANÇA GERAL"
          textoInicial={mensagemGrupo(agentesAtivos.map((m) => ({ membro: m, pendentes: tarefas.filter((t) => t.responsavel_id === m.id && t.status !== 'feito').sort((a, b) => ordenarEntregas(a, b, agora)) })), agora)}
          telefone={null}
          onFechar={() => setCobrando(false)}
        />
      )}
      {criandoArea && <EditorArea onFechar={() => setCriandoArea(false)} onCriada={(id) => navegar(`/operacoes?area=${id}`)} />}
      {emEdicao && <EditorTarefa key={emEdicao.id} tarefa={emEdicao} onFechar={() => setEditando(null)} />}
    </>
  )
}

interface FocoProps {
  area: Area
  ativas: Area[]
  tarefas: Tarefa[]
  agora: Date
  onEscolher: (id: string) => void
  onAbrir: (id: string) => void
}

function CartaoFoco({ area, ativas, tarefas, agora, onEscolher, onAbrir }: FocoProps) {
  const daArea = tarefas.filter((t) => t.area_id === area.id)
  const total = daArea.length
  const feitas = daArea.filter((t) => t.status === 'feito').length
  const fazendo = daArea.filter((t) => t.status === 'fazendo')
  const pct = total ? Math.round((feitas / total) * 100) : 0
  const nFeitas = total ? Math.round((feitas / total) * 40) : 0
  const nFazendo = total ? Math.round((fazendo.length / total) * 40) : 0
  const proxima = daArea
    .filter((t) => t.status !== 'feito' && t.prazo)
    .sort((a, b) => a.prazo!.localeCompare(b.prazo!))[0]
  const atual = [...fazendo].sort((a, b) => a.ordem - b.ordem)[0]
  const maxima = daArea.some((t) => t.status !== 'feito' && t.prioridade === 'maxima')

  return (
    <article className={`card ${s.bloco}`}>
      <div className={s.blocoTopo}>
        <div className={s.blocoTitulo}>
          <span className="mono" style={maxima ? { color: 'var(--c-destaque)' } : undefined}>
            {area.codigo ?? 'OPERAÇÃO'} · {maxima ? 'PRIORIDADE MÁXIMA' : 'EM FOCO'}
          </span>
          <h2>Operação {area.nome}</h2>
        </div>
        <label>
          <span className="sr">Operação em foco</span>
          <select className={s.seletor} value={area.id} onChange={(e) => onEscolher(e.target.value)}>
            {ativas.map((a) => (
              <option key={a.id} value={a.id}>{a.nome}</option>
            ))}
          </select>
        </label>
      </div>
      <div className={s.pct}>
        <span className={s.pctNum}>{pct}%</span>
        <span className={s.sub}>do dossiê concluído · {feitas} de {total}</span>
      </div>
      <div aria-hidden="true" className={s.ticks}>
        {Array.from({ length: 40 }, (_, i) => (
          <div key={i} style={{ background: i < nFeitas ? 'var(--c-texto)' : i < nFeitas + nFazendo ? 'var(--c-andamento)' : 'var(--c-borda)' }} />
        ))}
      </div>
      <div className={s.legenda}>
        <span><i style={{ background: 'var(--c-texto)' }} />Concluído</span>
        <span><i style={{ background: 'var(--c-andamento)' }} />Em andamento</span>
        <span><i style={{ background: 'var(--c-borda)', outline: '1px solid var(--c-borda-forte)' }} />A fazer</span>
      </div>
      <div className={s.subcartoes}>
        <button className={s.subcartao} disabled={!atual} onClick={() => atual && onAbrir(atual.id)}>
          <span className={s.subRotulo}>Em andamento</span>
          <span className={s.subTitulo}>{atual?.titulo ?? '—'}</span>
          <span className="mono">{atual ? codigoTarefa(atual.numero) : 'NADA EM CAMPO'}</span>
        </button>
        <button className={s.subcartao} disabled={!proxima} onClick={() => proxima && onAbrir(proxima.id)}>
          <span className={s.subRotulo}>Próximo prazo</span>
          <span className={s.subTitulo}>{proxima?.titulo ?? '—'}</span>
          <span className="mono" style={proxima && situacao(proxima, agora) === 'atrasada' ? { color: 'var(--c-destaque)' } : undefined}>
            {proxima ? formatarPrazo(proxima.prazo!, proxima.prazo_dia_inteiro, agora) : 'SEM PRAZOS'}
          </span>
        </button>
      </div>
    </article>
  )
}

function ItemOperacao({ area: a, indice, pendentes: n }: { area: Area; indice: number; pendentes: number }) {
  return (
    <Link to={`/operacoes?area=${a.id}`} className={s.op} data-arquivada={a.arquivada || undefined}>
      <span className={s.opNum} style={{ color: a.cor ?? undefined }}>{dd(indice + 1)}</span>
      <span className={s.opTexto}>
        <span className={s.opNome}>{a.nome}</span>
        <span className="mono">
          {a.codigo ?? '—'} · {n} {n === 1 ? 'PENDENTE' : 'PENDENTES'}
        </span>
      </span>
    </Link>
  )
}

function Seta() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M7 17L17 7M9 7h8v8" />
    </svg>
  )
}
