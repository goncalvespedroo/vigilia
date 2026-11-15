import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { horario, ROTULO_SITUACAO, situacaoReuniao } from '../lib/reunioes'
import type { Tarefa } from '../types/database'
import { useDados } from '../lib/dados'
import { diasEntre, situacao } from '../lib/prazo'
import { useAgora } from '../lib/useAgora'
import { PESO_PRIORIDADE } from '../lib/rotulos'
import { CapturaRapida } from '../components/CapturaRapida'
import { LinhaTarefa } from '../components/Checklist'
import { EditorTarefa } from '../components/EditorTarefa'
import s from './Hoje.module.css'

const SEMANA = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO']

const porPrazo = (a: Tarefa, b: Tarefa) =>
  (a.prazo ?? '').localeCompare(b.prazo ?? '') || PESO_PRIORIDADE[a.prioridade] - PESO_PRIORIDADE[b.prioridade]

export function Hoje() {
  const { tarefas, reunioes, carregando, erro } = useDados()
  const agora = useAgora()
  const [editando, setEditando] = useState<string | null>(null)

  const pendentes = tarefas.filter((t) => t.status !== 'feito')
  const atrasadas = pendentes.filter((t) => situacao(t, agora) === 'atrasada').sort(porPrazo)
  const deHoje = pendentes.filter((t) => situacao(t, agora) === 'hoje').sort(porPrazo)
  const proximas = pendentes.filter((t) => situacao(t, agora) === 'proxima').sort(porPrazo)
  const emAndamento = pendentes.filter((t) => t.status === 'fazendo' && situacao(t, agora) !== 'atrasada' && situacao(t, agora) !== 'hoje' && situacao(t, agora) !== 'proxima')
  const concluidasHoje = tarefas
    .filter((t) => t.status === 'feito' && t.concluida_em && diasEntre(new Date(t.concluida_em), agora) === 0)
    .sort((a, b) => (b.concluida_em ?? '').localeCompare(a.concluida_em ?? ''))

  const reunioesHoje = reunioes.filter((r) => r.status !== 'cancelada' && diasEntre(new Date(r.inicio), agora) === 0)
  const totalDia = deHoje.length + concluidasHoje.length
  const emEdicao = editando ? tarefas.find((t) => t.id === editando) : undefined
  const data = `${SEMANA[agora.getDay()]} · ${agora.toLocaleDateString('pt-BR').replaceAll('/', '.')}`

  return (
    <>
      <section className={s.cabeca}>
        <span className="mono">// DIRETRIZES DE HOJE · {data}</span>
        <h1 className={s.titulo}>Hoje</h1>
      </section>

      <div className={s.indicadores}>
        <Indicador rotulo="Atrasadas" valor={atrasadas.length} destaque={atrasadas.length > 0} />
        <Indicador rotulo="Vencem hoje" valor={deHoje.length} />
        <Indicador rotulo="Próximos 7 dias" valor={proximas.length} />
        <Indicador rotulo="Concluídas hoje" valor={concluidasHoje.length} sufixo={totalDia ? ` / ${totalDia}` : ''} />
      </div>

      <CapturaRapida paraHoje />

      {erro && <p className={s.erro}>Falha ao consultar a central: {erro}</p>}
      {carregando ? (
        <span className="mono">// CARREGANDO DOSSIÊS…</span>
      ) : (
        <div className={s.secoes}>
          {reunioesHoje.length > 0 && (
            <Secao titulo="Convocações de hoje" marca="hoje" n={reunioesHoje.length}>
              {reunioesHoje.map((r) => {
                const sit = situacaoReuniao(r, agora)
                return (
                  <Link key={r.id} to={`/reunioes/${r.id}`} className={s.reuniao}>
                    <span className={s.reuniaoHora}>{horario(r)}</span>
                    <span className={s.reuniaoTitulo}>{r.titulo}</span>
                    <span className="selo">{ROTULO_SITUACAO[sit]}</span>
                  </Link>
                )
              })}
            </Secao>
          )}
          {atrasadas.length > 0 && (
            <Secao titulo="Atrasadas" marca="atrasada" n={atrasadas.length}>
              {atrasadas.map((t) => <LinhaTarefa key={t.id} t={t} onAbrir={setEditando} />)}
            </Secao>
          )}
          <Secao titulo="Vencendo hoje" marca="hoje" n={deHoje.length}>
            {deHoje.length === 0 ? (
              <p className={s.vazio}>Nada vence hoje. Registre acima o que pretende resolver.</p>
            ) : (
              deHoje.map((t) => <LinhaTarefa key={t.id} t={t} onAbrir={setEditando} />)
            )}
          </Secao>
          {emAndamento.length > 0 && (
            <Secao titulo="Em andamento" marca="andamento" n={emAndamento.length}>
              {emAndamento.map((t) => <LinhaTarefa key={t.id} t={t} onAbrir={setEditando} />)}
            </Secao>
          )}
          <Secao titulo="Próximos 7 dias" marca="proxima" n={proximas.length}>
            {proximas.length === 0 ? (
              <p className={s.vazio}>Nenhum prazo na próxima semana.</p>
            ) : (
              proximas.map((t) => <LinhaTarefa key={t.id} t={t} onAbrir={setEditando} />)
            )}
          </Secao>
          {concluidasHoje.length > 0 && (
            <Secao titulo="Concluídas hoje" marca="feita" n={concluidasHoje.length}>
              {concluidasHoje.map((t) => <LinhaTarefa key={t.id} t={t} onAbrir={setEditando} />)}
            </Secao>
          )}
        </div>
      )}

      {emEdicao && <EditorTarefa key={emEdicao.id} tarefa={emEdicao} onFechar={() => setEditando(null)} />}
    </>
  )
}

function Indicador({ rotulo, valor, destaque, sufixo = '' }: { rotulo: string; valor: number; destaque?: boolean; sufixo?: string }) {
  return (
    <article className={`card ${s.indicador}`}>
      <h2>{rotulo}</h2>
      <span className={s.numero} style={destaque ? { color: 'var(--danger-text)' } : undefined}>
        {String(valor).padStart(2, '0')}
        {sufixo && <small>{sufixo}</small>}
      </span>
    </article>
  )
}

function Secao({ titulo, marca, n, children }: { titulo: string; marca: string; n: number; children: ReactNode }) {
  return (
    <section className={`card ${s.secao}`} data-marca={marca}>
      <header className={s.secaoCabeca}>
        <h2>{titulo}</h2>
        <span className="mono">{String(n).padStart(2, '0')}</span>
      </header>
      {children}
    </section>
  )
}
