import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import type { ItemPauta, StatusReuniao } from '../types/database'
import { useDados } from '../lib/dados'
import { useAgora } from '../lib/useAgora'
import { diaCurto, ehLink, horario, mensagemAta, mensagemConvocacao, ROTULO_SITUACAO, situacaoReuniao } from '../lib/reunioes'
import { EditorReuniao } from '../components/EditorReuniao'
import { EditorTarefa } from '../components/EditorTarefa'
import { CapturaRapida } from '../components/CapturaRapida'
import { LinhaTarefa } from '../components/Checklist'
import { Cobranca } from '../components/Cobranca'
import s from './ReuniaoDossie.module.css'

const STATUS: { valor: StatusReuniao; rotulo: string }[] = [
  { valor: 'agendada', rotulo: 'Agendada' },
  { valor: 'realizada', rotulo: 'Realizada' },
  { valor: 'cancelada', rotulo: 'Cancelada' },
]

export function ReuniaoDossie() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const agora = useAgora()
  const {
    reunioes, itensPauta, participantes, membros, membroPorId, tarefas, areaPorId, carregando,
    atualizarReuniao, criarItemPauta, atualizarItemPauta, excluirItemPauta, convocar, desconvocar, marcarPresenca,
  } = useDados()
  const [editando, setEditando] = useState(false)
  const [editandoTarefa, setEditandoTarefa] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<{ titulo: string; texto: string } | null>(null)
  const [novoItem, setNovoItem] = useState('')

  const r = reunioes.find((x) => x.id === id)
  if (!r) {
    return (
      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
        <span className="mono">{carregando ? '// CARREGANDO DOSSIÊ…' : '// DOSSIÊ NÃO ENCONTRADO'}</span>
        {!carregando && <Link to="/reunioes" className="btn">Voltar às reuniões</Link>}
      </section>
    )
  }

  const sit = situacaoReuniao(r, agora)
  const itens = itensPauta.filter((i) => i.reuniao_id === r.id)
  const conv = participantes.filter((p) => p.reuniao_id === r.id)
  const convPorMembro = new Map(conv.map((p) => [p.membro_id, p]))
  const encaminhamentos = tarefas.filter((t) => t.reuniao_id === r.id).sort((a, b) => a.created_at.localeCompare(b.created_at))
  const area = r.area_id ? areaPorId.get(r.area_id) : undefined
  const presentes = conv.filter((p) => p.presente === true).length
  const discutidos = itens.filter((i) => i.discutido).length
  const candidatos = membros.filter((m) => m.ativo || convPorMembro.has(m.id))
  const ctx = { reuniao: r, itens, participantes: conv, membroPorId, area, encaminhamentos }
  const tarefaEmEdicao = editandoTarefa ? tarefas.find((t) => t.id === editandoTarefa) : undefined

  function adicionarItem(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter' || !novoItem.trim()) return
    e.preventDefault()
    void criarItemPauta(r!.id, novoItem)
    setNovoItem('')
  }

  function mover(item: ItemPauta, direcao: -1 | 1) {
    const i = itens.findIndex((x) => x.id === item.id)
    const vizinho = itens[i + direcao]
    if (!vizinho) return
    void atualizarItemPauta(item.id, { ordem: vizinho.ordem })
    void atualizarItemPauta(vizinho.id, { ordem: item.ordem })
  }

  return (
    <>
      <nav className={s.trilha}><Link to="/reunioes">← Reuniões</Link></nav>

      <section className={s.cabeca}>
        <div className={s.cabecaTexto}>
          <span className="mono">
            // CONVOCAÇÃO · {diaCurto(r.inicio, agora)} · {horario(r)}{area ? ` · ${area.nome.toUpperCase()}` : ''}
          </span>
          <h1 className={s.titulo} data-sit={sit}>{r.titulo}</h1>
          {r.local && (
            ehLink(r.local) ? (
              <a className={s.local} href={r.local.trim()} target="_blank" rel="noopener noreferrer">↗ Entrar na chamada</a>
            ) : (
              <span className={s.localTexto}>📍 {r.local}</span>
            )
          )}
        </div>
        <span className={s.pilula} data-sit={sit}>{ROTULO_SITUACAO[sit]}</span>
      </section>

      <div className={s.barra}>
        <div className={s.status} role="group" aria-label="Status da reunião">
          {STATUS.map((st) => (
            <button key={st.valor} aria-pressed={r.status === st.valor} data-valor={st.valor} onClick={() => void atualizarReuniao(r.id, { status: st.valor })}>
              {st.rotulo}
            </button>
          ))}
        </div>
        <span className={s.espaco} />
        <button className="btn" onClick={() => setEditando(true)}>Editar convocação</button>
        <button className="btn" onClick={() => setMensagem({ titulo: 'CONVOCAÇÃO', texto: mensagemConvocacao(ctx) })}>Enviar convocação</button>
        <button className="btn btn--destaque" onClick={() => setMensagem({ titulo: 'ATA', texto: mensagemAta(ctx) })}>Compartilhar ata</button>
      </div>

      <div className={s.grade}>
        <div className={s.principal}>
          {/* Pauta */}
          <article className={`card ${s.bloco}`}>
            <header className={s.blocoTopo}>
              <h2>Pauta</h2>
              <span className="mono">{discutidos}/{itens.length} DISCUTIDOS</span>
            </header>
            <ol className={s.pauta}>
              {itens.map((item, i) => (
                <ItemDaPauta
                  key={item.id}
                  item={item}
                  n={i + 1}
                  primeiro={i === 0}
                  ultimo={i === itens.length - 1}
                  onMover={(dir) => mover(item, dir)}
                  onAlterar={(alt) => void atualizarItemPauta(item.id, alt)}
                  onExcluir={() => void excluirItemPauta(item.id)}
                />
              ))}
            </ol>
            <label className={s.novo}>
              <span aria-hidden="true">+</span>
              <span className="sr">Novo item da pauta</span>
              <input value={novoItem} onChange={(e) => setNovoItem(e.target.value)} onKeyDown={adicionarItem} placeholder="Adicionar item à pauta (Enter)" />
            </label>
          </article>

          {/* Encaminhamentos */}
          <article className={`card ${s.bloco}`}>
            <header className={s.blocoTopo}>
              <h2>Encaminhamentos</h2>
              <span className="mono">{encaminhamentos.length} {encaminhamentos.length === 1 ? 'TAREFA' : 'TAREFAS'}</span>
            </header>
            <CapturaRapida
              reuniaoId={r.id}
              areaPadrao={r.area_id}
              placeholder="Registrar encaminhamento… (+agente @prazo)"
            />
            <div>
              {encaminhamentos.length === 0 && <p className={s.vazio}>Decisões que viram tarefa entram aqui — e aparecem também em Operações e Hoje.</p>}
              {encaminhamentos.map((t) => <LinhaTarefa key={t.id} t={t} onAbrir={setEditandoTarefa} />)}
            </div>
          </article>

          {/* Ata */}
          <article className={`card ${s.bloco}`}>
            <header className={s.blocoTopo}>
              <h2>Ata</h2>
              <span className="mono">OBSERVAÇÕES GERAIS</span>
            </header>
            <CampoAta key={r.id} valor={r.ata ?? ''} onSalvar={(ata) => atualizarReuniao(r.id, { ata: ata || null })} />
          </article>
        </div>

        {/* Convocados */}
        <aside className={s.lateral}>
          <article className={`card ${s.bloco}`}>
            <header className={s.blocoTopo}>
              <h2>Convocados</h2>
              <span className="mono">{conv.length ? `${presentes}/${conv.length} PRESENTES` : 'NINGUÉM'}</span>
            </header>
            {candidatos.length === 0 && <p className={s.vazio}>Cadastre a equipe em <Link to="/agentes" className={s.link}>Agentes</Link> para convocar.</p>}
            <ul className={s.convocados}>
              {candidatos.map((m) => {
                const p = convPorMembro.get(m.id)
                return (
                  <li key={m.id} className={s.convocado} data-convocado={!!p || undefined}>
                    <label className={s.convocar}>
                      <input
                        type="checkbox"
                        checked={!!p}
                        onChange={() => (p ? void desconvocar(p.id) : void convocar(r.id, m.id))}
                      />
                      <span className={s.convNome}>
                        <span>{m.nome}</span>
                        {m.funcao && <span className="mono">{m.funcao.toUpperCase()}</span>}
                      </span>
                    </label>
                    {p && (
                      <div className={s.presenca} role="group" aria-label={`Presença de ${m.nome}`}>
                        <button aria-pressed={p.presente === true} data-tipo="sim" title="Presente" onClick={() => void marcarPresenca(p.id, p.presente === true ? null : true)}>✓</button>
                        <button aria-pressed={p.presente === false} data-tipo="nao" title="Ausente" onClick={() => void marcarPresenca(p.id, p.presente === false ? null : false)}>✕</button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </article>
        </aside>
      </div>

      {editando && <EditorReuniao reuniao={r} onFechar={() => setEditando(false)} onExcluida={() => navegar('/reunioes')} />}
      {tarefaEmEdicao && <EditorTarefa key={tarefaEmEdicao.id} tarefa={tarefaEmEdicao} onFechar={() => setEditandoTarefa(null)} />}
      {mensagem && <Cobranca titulo={mensagem.titulo} textoInicial={mensagem.texto} telefone={null} onFechar={() => setMensagem(null)} />}
    </>
  )
}

interface ItemProps {
  item: ItemPauta
  n: number
  primeiro: boolean
  ultimo: boolean
  onMover: (dir: -1 | 1) => void
  onAlterar: (alt: Partial<Pick<ItemPauta, 'texto' | 'discutido' | 'notas'>>) => void
  onExcluir: () => void
}

function ItemDaPauta({ item, n, primeiro, ultimo, onMover, onAlterar, onExcluir }: ItemProps) {
  const [notasAbertas, setNotasAbertas] = useState(!!item.notas)
  return (
    <li className={s.item} data-discutido={item.discutido || undefined}>
      <div className={s.itemLinha}>
        <input type="checkbox" className={s.check} checked={item.discutido} aria-label={`Discutido: ${item.texto}`} onChange={() => onAlterar({ discutido: !item.discutido })} />
        <span className={s.num}>{String(n).padStart(2, '0')}</span>
        <input
          className={s.itemTexto}
          defaultValue={item.texto}
          aria-label={`Item ${n} da pauta`}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          onBlur={(e) => {
            const v = e.target.value.trim()
            if (!v) e.target.value = item.texto
            else if (v !== item.texto) onAlterar({ texto: v })
          }}
        />
        <div className={s.itemAcoes}>
          <button aria-label="Notas" aria-pressed={notasAbertas} onClick={() => setNotasAbertas((x) => !x)} title="Notas">✎</button>
          <button aria-label="Subir" disabled={primeiro} onClick={() => onMover(-1)}>↑</button>
          <button aria-label="Descer" disabled={ultimo} onClick={() => onMover(1)}>↓</button>
          <button aria-label={`Remover item ${n}`} data-perigo onClick={onExcluir}>×</button>
        </div>
      </div>
      {notasAbertas && (
        <textarea
          className={s.notas}
          rows={3}
          defaultValue={item.notas ?? ''}
          placeholder="Notas da discussão…"
          aria-label={`Notas do item ${n}`}
          onBlur={(e) => {
            const v = e.target.value.trim() || null
            if (v !== item.notas) onAlterar({ notas: v })
          }}
        />
      )}
    </li>
  )
}

/** Ata com salvamento automático (ao parar de digitar e ao sair do campo). */
function CampoAta({ valor, onSalvar }: { valor: string; onSalvar: (v: string) => Promise<string | null> }) {
  const [texto, setTexto] = useState(valor)
  const [estado, setEstado] = useState<'salvo' | 'pendente' | 'salvando' | 'erro'>('salvo')
  const ultimoSalvo = useRef(valor)

  // Atualização vinda de outro dispositivo, enquanto não há edição local pendente
  useEffect(() => {
    if (estado === 'salvo' && valor !== ultimoSalvo.current) {
      setTexto(valor)
      ultimoSalvo.current = valor
    }
  }, [valor, estado])

  async function salvar(v: string) {
    if (v === ultimoSalvo.current) return setEstado('salvo')
    setEstado('salvando')
    const falha = await onSalvar(v)
    if (falha) return setEstado('erro')
    ultimoSalvo.current = v
    setEstado('salvo')
  }

  useEffect(() => {
    if (estado !== 'pendente') return
    const t = window.setTimeout(() => void salvar(texto), 1200)
    return () => window.clearTimeout(t)
  }, [texto, estado])

  return (
    <div className={s.ata}>
      <textarea
        rows={8}
        value={texto}
        placeholder="Decisões, avisos, contexto que não cabe na pauta…"
        aria-label="Ata da reunião"
        onChange={(e) => {
          setTexto(e.target.value)
          setEstado('pendente')
        }}
        onBlur={() => void salvar(texto)}
      />
      <span className="mono" data-estado={estado}>
        {estado === 'salvo' ? '● SALVO' : estado === 'salvando' ? '◌ SALVANDO…' : estado === 'erro' ? '× NÃO SALVO — TENTE DE NOVO' : '○ EDITANDO…'}
      </span>
    </div>
  )
}
