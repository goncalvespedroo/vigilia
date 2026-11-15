import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import type { Reuniao } from '../types/database'
import { useDados } from '../lib/dados'
import { useAgora } from '../lib/useAgora'
import { diaCurto, horario, porVir, ROTULO_SITUACAO, situacaoReuniao } from '../lib/reunioes'
import { EditorReuniao } from '../components/EditorReuniao'
import s from './Reunioes.module.css'

export function Reunioes() {
  const { reunioes, carregando } = useDados()
  const agora = useAgora()
  const navegar = useNavigate()
  const [criando, setCriando] = useState(false)

  const proximas = reunioes.filter((r) => porVir(r, agora))
  const anteriores = reunioes.filter((r) => !porVir(r, agora)).reverse()
  const aguardandoAta = anteriores.filter((r) => situacaoReuniao(r, agora) === 'aguardando_ata')

  return (
    <>
      <section className={s.cabeca}>
        <div className={s.cabecaTexto}>
          <span className="mono">
            // CONVOCAÇÕES · {proximas.length} {proximas.length === 1 ? 'AGENDADA' : 'AGENDADAS'}
            {aguardandoAta.length ? ` · ${aguardandoAta.length} AGUARDANDO ATA` : ''}
          </span>
          <h1 className={s.titulo}>Reuniões</h1>
        </div>
        <button className="btn btn--destaque" onClick={() => setCriando(true)}>+ Convocar reunião</button>
      </section>

      {!carregando && reunioes.length === 0 && (
        <section className={`card ${s.vazio}`}>
          <span className="mono">NENHUMA CONVOCAÇÃO NO REGISTRO</span>
          <p>Agende reuniões com pauta, convoque agentes, marque presença e registre a ata com os encaminhamentos.</p>
          <button className="btn btn--destaque" onClick={() => setCriando(true)}>Convocar a primeira reunião</button>
        </section>
      )}

      {proximas.length > 0 && (
        <section className={s.secao}>
          <h2 className={s.h2}>Próximas</h2>
          <div className={s.lista}>{proximas.map((r) => <CartaoReuniao key={r.id} r={r} agora={agora} />)}</div>
        </section>
      )}

      {anteriores.length > 0 && (
        <details className={s.secao} open={aguardandoAta.length > 0 || proximas.length === 0}>
          <summary className={s.h2}>Anteriores <span className="mono">({anteriores.length})</span></summary>
          <div className={s.lista}>{anteriores.slice(0, 30).map((r) => <CartaoReuniao key={r.id} r={r} agora={agora} />)}</div>
        </details>
      )}

      {criando && <EditorReuniao onFechar={() => setCriando(false)} onCriada={(id) => navegar(`/reunioes/${id}`)} />}
    </>
  )
}

function CartaoReuniao({ r, agora }: { r: Reuniao; agora: Date }) {
  const { itensPauta, participantes, areaPorId } = useDados()
  const sit = situacaoReuniao(r, agora)
  const itens = itensPauta.filter((i) => i.reuniao_id === r.id)
  const conv = participantes.filter((p) => p.reuniao_id === r.id)
  const area = r.area_id ? areaPorId.get(r.area_id) : undefined
  const d = new Date(r.inicio)
  return (
    <Link to={`/reunioes/${r.id}`} className={`card ${s.cartao}`} data-sit={sit}>
      <div className={s.data} aria-hidden="true">
        <span className={s.dia}>{String(d.getDate()).padStart(2, '0')}</span>
        <span className="mono">{d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase()}</span>
      </div>
      <div className={s.corpo}>
        <span className="mono">{diaCurto(r.inicio, agora)} · {horario(r)}{r.local ? ` · ${r.local.length > 32 ? r.local.slice(0, 32) + '…' : r.local}` : ''}</span>
        <strong className={s.nome}>{r.titulo}</strong>
        <span className={s.meta}>
          {area && <span className="selo"><span className="ponto-area" style={{ background: area.cor ?? 'var(--text-2)' }} />{area.nome.toUpperCase()}</span>}
          <span className="selo">{itens.length} {itens.length === 1 ? 'ITEM' : 'ITENS'} NA PAUTA</span>
          <span className="selo">{conv.length} {conv.length === 1 ? 'CONVOCADO' : 'CONVOCADOS'}</span>
        </span>
      </div>
      <span className={s.pilula} data-sit={sit}>{ROTULO_SITUACAO[sit]}</span>
    </Link>
  )
}
