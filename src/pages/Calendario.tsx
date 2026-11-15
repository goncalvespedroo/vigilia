import { useMemo, useState, type DragEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { Reuniao, Tarefa } from '../types/database'
import { useDados } from '../lib/dados'
import { useCentral } from '../lib/central'
import { diasEntre, inicioDoDia, montarPrazo, situacao, somarDias } from '../lib/prazo'
import { hora, horario } from '../lib/reunioes'
import { useAgora } from '../lib/useAgora'
import { LinhaTarefa } from '../components/Checklist'
import { CapturaRapida } from '../components/CapturaRapida'
import s from './Calendario.module.css'

const SEMANA = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const MAX_NO_DIA = 3
const dd = (n: number) => String(n).padStart(2, '0')
const chave = (d: Date) => `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`

function lerDia(texto: string | null): Date | null {
  const m = texto?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const d = new Date(+m[1]!, +m[2]! - 1, +m[3]!)
  return Number.isNaN(d.getTime()) ? null : d
}

type Item = { tipo: 'tarefa'; t: Tarefa; quando: Date } | { tipo: 'reuniao'; r: Reuniao; quando: Date }

/** Calendário de operações: prazos das missões e convocações num só lugar. */
export function Calendario() {
  const { tarefas, reunioes, areaPorId, atualizarTarefa, semRede } = useDados()
  const { abrirTarefa } = useCentral()
  const agora = useAgora()
  const hoje = inicioDoDia(agora)
  const [params, setParams] = useSearchParams()
  const [soltandoEm, setSoltandoEm] = useState<string | null>(null)

  const selecionado = lerDia(params.get('d')) ?? hoje
  const mesBase = lerDia(`${params.get('m') ?? ''}-01`) ?? new Date(selecionado.getFullYear(), selecionado.getMonth(), 1)

  function ir(dia: Date, mes = new Date(dia.getFullYear(), dia.getMonth(), 1)) {
    const p = new URLSearchParams(params)
    p.set('d', chave(dia))
    p.set('m', chave(mes).slice(0, 7))
    setParams(p, { replace: true })
  }
  const mudarMes = (n: number) => {
    const novo = new Date(mesBase.getFullYear(), mesBase.getMonth() + n, 1)
    const p = new URLSearchParams(params)
    p.set('m', chave(novo).slice(0, 7))
    setParams(p, { replace: true })
  }

  // Grade: 6 semanas começando na segunda-feira anterior ao dia 1
  const inicioGrade = somarDias(mesBase, -((mesBase.getDay() + 6) % 7))
  const dias = Array.from({ length: 42 }, (_, i) => somarDias(inicioGrade, i))

  // Itens por dia (prazos de missões + reuniões)
  const porDia = useMemo(() => {
    const mapa = new Map<string, Item[]>()
    const add = (d: Date, item: Item) => {
      const k = chave(d)
      mapa.set(k, [...(mapa.get(k) ?? []), item])
    }
    for (const t of tarefas) if (t.prazo) add(new Date(t.prazo), { tipo: 'tarefa', t, quando: new Date(t.prazo) })
    for (const r of reunioes) add(new Date(r.inicio), { tipo: 'reuniao', r, quando: new Date(r.inicio) })
    // Reuniões primeiro, depois por horário; dia inteiro (23:59) cai no fim
    for (const lista of mapa.values())
      lista.sort((a, b) => Number(a.tipo === 'tarefa') - Number(b.tipo === 'tarefa') || a.quando.getTime() - b.quando.getTime())
    return mapa
  }, [tarefas, reunioes])

  const doDia = porDia.get(chave(selecionado)) ?? []
  const reunioesDoDia = doDia.filter((i): i is Extract<Item, { tipo: 'reuniao' }> => i.tipo === 'reuniao')
  const tarefasDoDia = doDia.filter((i): i is Extract<Item, { tipo: 'tarefa' }> => i.tipo === 'tarefa')
  const pendentesNoMes = tarefas.filter(
    (t) => t.prazo && t.status !== 'feito' && new Date(t.prazo).getMonth() === mesBase.getMonth() && new Date(t.prazo).getFullYear() === mesBase.getFullYear(),
  ).length

  // Arrastar uma missão para outro dia remarca o prazo (mantém o horário)
  function soltar(e: DragEvent, dia: Date) {
    e.preventDefault()
    setSoltandoEm(null)
    const id = e.dataTransfer.getData('text/vigilia-tarefa')
    const t = tarefas.find((x) => x.id === id)
    if (!t?.prazo || semRede || diasEntre(new Date(t.prazo), dia) === 0) return
    const antigo = new Date(t.prazo)
    void atualizarTarefa(t.id, t.prazo_dia_inteiro ? montarPrazo(dia) : montarPrazo(dia, { h: antigo.getHours(), m: antigo.getMinutes() }))
  }

  const tituloDia = selecionado.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const relativo = diasEntre(hoje, selecionado)

  return (
    <>
      <section className={s.cabeca}>
        <div className={s.cabecaTexto}>
          <span className="mono">
            CALENDÁRIO DE OPERAÇÕES · {pendentesNoMes} {pendentesNoMes === 1 ? 'PRAZO ABERTO' : 'PRAZOS ABERTOS'} NO MÊS
          </span>
          <h1 className={s.titulo}>Calendário</h1>
        </div>
        <div className={s.controles}>
          <button className={s.navMes} onClick={() => mudarMes(-1)} aria-label="Mês anterior">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <span className={s.mes} aria-live="polite">
            {MESES[mesBase.getMonth()]} <span>{mesBase.getFullYear()}</span>
          </span>
          <button className={s.navMes} onClick={() => mudarMes(1)} aria-label="Próximo mês">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          </button>
          <button className="btn" onClick={() => ir(hoje)}>Hoje</button>
        </div>
      </section>

      <div className={s.grade}>
        <div className={`card ${s.mesCard}`}>
          <div className={s.semana} aria-hidden="true">
            {SEMANA.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className={s.dias} role="group" aria-label={`${MESES[mesBase.getMonth()]} de ${mesBase.getFullYear()}`}>
            {dias.map((dia) => {
              const k = chave(dia)
              const itens = porDia.get(k) ?? []
              const fora = dia.getMonth() !== mesBase.getMonth()
              const atrasada = itens.some((i) => i.tipo === 'tarefa' && situacao(i.t, agora) === 'atrasada')
              return (
                <div
                  key={k}
                  className={s.dia}
                  data-fora={fora || undefined}
                  data-hoje={diasEntre(dia, hoje) === 0 || undefined}
                  data-selecionado={diasEntre(dia, selecionado) === 0 || undefined}
                  data-soltando={soltandoEm === k || undefined}
                  onDragOver={(e) => {
                    if (!e.dataTransfer.types.includes('text/vigilia-tarefa')) return
                    e.preventDefault()
                    if (soltandoEm !== k) setSoltandoEm(k)
                  }}
                  onDragLeave={() => soltandoEm === k && setSoltandoEm(null)}
                  onDrop={(e) => soltar(e, dia)}
                >
                  <button
                    className={s.diaBotao}
                    onClick={() => ir(dia, fora ? new Date(dia.getFullYear(), dia.getMonth(), 1) : mesBase)}
                    aria-label={`${dia.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}: ${itens.length} ${itens.length === 1 ? 'registro' : 'registros'}`}
                    aria-pressed={diasEntre(dia, selecionado) === 0}
                  >
                    <span className={s.num}>{dd(dia.getDate())}</span>
                    {itens.length > 0 && (
                      <span className={s.pontos} aria-hidden="true">
                        {itens.slice(0, 4).map((i, n) => (
                          <i
                            key={n}
                            style={{
                              background:
                                i.tipo === 'reuniao'
                                  ? 'var(--accent)'
                                  : (i.t.area_id && areaPorId.get(i.t.area_id)?.cor) || 'var(--text-2)',
                            }}
                          />
                        ))}
                        {atrasada && <b />}
                      </span>
                    )}
                  </button>
                  <ul className={s.itens}>
                    {itens.slice(0, MAX_NO_DIA).map((i) =>
                      i.tipo === 'reuniao' ? (
                        <li key={i.r.id}>
                          <Link to={`/reunioes/${i.r.id}`} className={s.chip} data-reuniao data-feito={i.r.status !== 'agendada' || undefined}>
                            <span className={s.chipHora}>{hora(i.r.inicio)}</span>
                            <span className={s.chipTexto}>{i.r.titulo}</span>
                          </Link>
                        </li>
                      ) : (
                        <li key={i.t.id}>
                          <button
                            className={s.chip}
                            draggable={!semRede}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/vigilia-tarefa', i.t.id)
                              e.dataTransfer.effectAllowed = 'move'
                            }}
                            onClick={() => abrirTarefa(i.t.id)}
                            data-feito={i.t.status === 'feito' || undefined}
                            data-atrasada={situacao(i.t, agora) === 'atrasada' || undefined}
                            title={i.t.titulo}
                          >
                            <span className="ponto-area" style={{ background: (i.t.area_id && areaPorId.get(i.t.area_id)?.cor) || 'var(--text-2)' }} />
                            {!i.t.prazo_dia_inteiro && <span className={s.chipHora}>{hora(i.t.prazo!)}</span>}
                            <span className={s.chipTexto}>{i.t.titulo}</span>
                          </button>
                        </li>
                      ),
                    )}
                    {itens.length > MAX_NO_DIA && (
                      <li>
                        <button className={s.mais} onClick={() => ir(dia, mesBase)}>
                          +{itens.length - MAX_NO_DIA} {itens.length - MAX_NO_DIA === 1 ? 'registro' : 'registros'}
                        </button>
                      </li>
                    )}
                  </ul>
                </div>
              )
            })}
          </div>
          <p className={s.dica}>ARRASTE UMA MISSÃO PARA OUTRO DIA PARA REMARCAR O PRAZO</p>
        </div>

        <aside className={`card ${s.painelDia}`} aria-labelledby="cal-dia">
          <div className={s.diaTopo}>
            <span className={s.diaMeta}>
              {relativo === 0 ? 'HOJE' : relativo === 1 ? 'AMANHÃ' : relativo === -1 ? 'ONTEM' : chave(selecionado).split('-').reverse().join('.')}
              {' · '}
              {doDia.length} {doDia.length === 1 ? 'REGISTRO' : 'REGISTROS'}
            </span>
            <h2 id="cal-dia" className={s.diaTitulo}>{tituloDia}</h2>
          </div>

          {reunioesDoDia.length > 0 && (
            <div className={s.bloco}>
              <span className={s.blocoRotulo}>CONVOCAÇÕES</span>
              {reunioesDoDia.map(({ r }) => (
                <Link key={r.id} to={`/reunioes/${r.id}`} className={s.reuniao} data-feito={r.status !== 'agendada' || undefined}>
                  <span className={s.reuniaoHora}>{horario(r)}</span>
                  <span className={s.reuniaoTitulo}>{r.titulo}</span>
                  {r.status === 'cancelada' && <span className="selo">CANCELADA</span>}
                </Link>
              ))}
            </div>
          )}

          <div className={s.bloco}>
            <span className={s.blocoRotulo}>MISSÕES</span>
            {tarefasDoDia.length === 0 ? (
              <div className="vazio">
                <strong>Dia livre</strong>
                Nenhum prazo neste dia.
              </div>
            ) : (
              <div>
                {tarefasDoDia.map(({ t }) => (
                  <LinhaTarefa key={t.id} t={t} onAbrir={abrirTarefa} />
                ))}
              </div>
            )}
          </div>

          <CapturaRapida
            key={chave(selecionado)}
            diaPadrao={selecionado}
            compacta
            placeholder={`Missão para ${relativo === 0 ? 'hoje' : chave(selecionado).split('-').slice(1).reverse().join('/')}…`}
          />
        </aside>
      </div>
    </>
  )
}
