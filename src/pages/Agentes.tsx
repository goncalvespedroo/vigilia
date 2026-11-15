import { useState } from 'react'
import type { Membro, Tarefa } from '../types/database'
import { useDados } from '../lib/dados'
import { useAgora } from '../lib/useAgora'
import { formatarPrazo } from '../lib/prazo'
import { codigoTarefa } from '../lib/rotulos'
import { formatarTelefone, mensagemCobranca, mensagemGrupo, ordenarEntregas, ROTULO_ENTREGA, situacaoEntrega } from '../lib/equipe'
import { EditorMembro } from '../components/EditorMembro'
import { EditorTarefa } from '../components/EditorTarefa'
import { Cobranca } from '../components/Cobranca'
import s from './Agentes.module.css'

const TRINTA_DIAS = 30 * 86_400_000

type Cobrar = { titulo: string; texto: string; telefone: string | null }

export function Agentes() {
  const { membros, tarefas, carregando } = useDados()
  const agora = useAgora()
  const [editandoMembro, setEditandoMembro] = useState<string | null>(null) // 'novo' | id
  const [editandoTarefa, setEditandoTarefa] = useState<string | null>(null)
  const [cobrar, setCobrar] = useState<Cobrar | null>(null)

  const ativos = membros.filter((m) => m.ativo)
  const afastados = membros.filter((m) => !m.ativo)
  const dadosDe = (m: Membro) => {
    const todas = tarefas.filter((t) => t.responsavel_id === m.id)
    const pendentes = todas.filter((t) => t.status !== 'feito').sort((a, b) => ordenarEntregas(a, b, agora))
    const entregues30 = todas.filter((t) => t.status === 'feito' && t.concluida_em && agora.getTime() - new Date(t.concluida_em).getTime() < TRINTA_DIAS)
    const atrasadas = pendentes.filter((t) => situacaoEntrega(t, agora) === 'atrasado')
    return { pendentes, entregues30, atrasadas }
  }
  const totalAtrasadas = ativos.reduce((n, m) => n + dadosDe(m).atrasadas.length, 0)
  const membroEmEdicao = editandoMembro && editandoMembro !== 'novo' ? membros.find((m) => m.id === editandoMembro) : undefined
  const tarefaEmEdicao = editandoTarefa ? tarefas.find((t) => t.id === editandoTarefa) : undefined

  return (
    <>
      <section className={s.cabeca}>
        <div className={s.cabecaTexto}>
          <span className="mono">// EQUIPE · {ativos.length} {ativos.length === 1 ? 'AGENTE ATIVO' : 'AGENTES ATIVOS'}{totalAtrasadas ? ` · ${totalAtrasadas} EM ATRASO` : ''}</span>
          <h1 className={s.titulo}>Agentes</h1>
        </div>
        <div className={s.acoes}>
          {ativos.length > 0 && (
            <button className="btn" onClick={() => setCobrar({
              titulo: 'COBRANÇA GERAL',
              texto: mensagemGrupo(ativos.map((m) => ({ membro: m, pendentes: dadosDe(m).pendentes })), agora),
              telefone: null,
            })}>
              Cobrar pendentes
            </button>
          )}
          <button className="btn btn--destaque" onClick={() => setEditandoMembro('novo')}>+ Recrutar agente</button>
        </div>
      </section>

      {!carregando && membros.length === 0 && (
        <section className={`card ${s.vazio}`}>
          <span className="mono">// NENHUM AGENTE EM CAMPO</span>
          <p>Cadastre as pessoas da equipe para atribuir entregas e acompanhar quem está com o quê. No registro rápido, use <code className="mono">+nome</code> para definir o responsável.</p>
          <button className="btn btn--destaque" onClick={() => setEditandoMembro('novo')}>Recrutar o primeiro agente</button>
        </section>
      )}

      <div className={s.grade}>
        {ativos.map((m) => {
          const { pendentes, entregues30, atrasadas } = dadosDe(m)
          return (
            <article key={m.id} className={`card ${s.agente}`} data-atraso={atrasadas.length > 0 || undefined}>
              <header className={s.agenteTopo}>
                <div aria-hidden="true" className={s.avatar}>{m.nome.charAt(0).toUpperCase()}</div>
                <div className={s.agenteNome}>
                  <strong>{m.nome}</strong>
                  <span className="mono">
                    {(m.funcao ?? 'SEM FUNÇÃO').toUpperCase()}
                    {m.telefone && <> · <span className={s.tel}>{formatarTelefone(m.telefone)}</span></>}
                  </span>
                </div>
                <button className={s.editar} aria-label={`Editar ${m.nome}`} onClick={() => setEditandoMembro(m.id)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" /></svg>
                </button>
              </header>

              <div className={s.numeros}>
                <span><b>{pendentes.length - atrasadas.length}</b> em campo</span>
                <span data-atraso={atrasadas.length > 0 || undefined}><b>{atrasadas.length}</b> {atrasadas.length === 1 ? 'atrasada' : 'atrasadas'}</span>
                <span><b>{entregues30.length}</b> {entregues30.length === 1 ? 'entregue' : 'entregues'} em 30d</span>
              </div>

              <ul className={s.entregas}>
                {pendentes.length === 0 && <li className={s.semEntregas}>Nenhuma entrega pendente.</li>}
                {pendentes.map((t) => <LinhaEntrega key={t.id} t={t} agora={agora} onAbrir={setEditandoTarefa} />)}
              </ul>

              <button
                className={`btn ${atrasadas.length ? 'btn--destaque' : ''}`}
                disabled={!pendentes.length}
                onClick={() => setCobrar({ titulo: `COBRANÇA · ${m.nome.toUpperCase()}`, texto: mensagemCobranca(m, pendentes, agora), telefone: m.telefone })}
              >
                {m.telefone ? 'Cobrar no WhatsApp' : 'Preparar cobrança'}
              </button>
            </article>
          )
        })}
      </div>

      {afastados.length > 0 && (
        <details className={`card ${s.afastados}`}>
          <summary className="mono">AFASTADOS ({afastados.length})</summary>
          {afastados.map((m) => (
            <button key={m.id} className={s.afastado} onClick={() => setEditandoMembro(m.id)}>
              <span>{m.nome}</span>
              <span className="mono">{(m.funcao ?? '').toUpperCase()}</span>
            </button>
          ))}
        </details>
      )}

      {editandoMembro === 'novo' && <EditorMembro key="novo" onFechar={() => setEditandoMembro(null)} />}
      {membroEmEdicao && <EditorMembro key={membroEmEdicao.id} membro={membroEmEdicao} onFechar={() => setEditandoMembro(null)} />}
      {tarefaEmEdicao && <EditorTarefa key={tarefaEmEdicao.id} tarefa={tarefaEmEdicao} onFechar={() => setEditandoTarefa(null)} />}
      {cobrar && <Cobranca titulo={cobrar.titulo} textoInicial={cobrar.texto} telefone={cobrar.telefone} onFechar={() => setCobrar(null)} />}
    </>
  )
}

function LinhaEntrega({ t, agora, onAbrir }: { t: Tarefa; agora: Date; onAbrir: (id: string) => void }) {
  const sit = situacaoEntrega(t, agora)
  return (
    <li>
      <button className={s.entrega} onClick={() => onAbrir(t.id)}>
        <span className={s.entregaTitulo}>{t.titulo}</span>
        <span className={s.entregaMeta}>
          <span className="mono">{t.prazo ? formatarPrazo(t.prazo, t.prazo_dia_inteiro, agora) : codigoTarefa(t.numero)}</span>
          <span className={s.pilula} data-sit={sit}>{ROTULO_ENTREGA[sit]}</span>
        </span>
      </button>
    </li>
  )
}
