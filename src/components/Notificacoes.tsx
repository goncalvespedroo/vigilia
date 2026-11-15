import { useCallback, useEffect, useRef, useState } from 'react'
import type { InscricaoPush } from '../types/database'
import {
  ativarPush, desativarPush, endpointAtual, enviarTeste, estadoPush, listarDispositivos, removerDispositivo,
  type EstadoPush,
} from '../lib/push'
import d from './Dialogo.module.css'
import s from './Notificacoes.module.css'

const TEXTO: Record<EstadoPush, { rotulo: string; detalhe: string }> = {
  ativo: { rotulo: '● ALERTAS ATIVOS NESTE DISPOSITIVO', detalhe: 'Você recebe os avisos de prazo aqui, mesmo com o app fechado.' },
  inativo: { rotulo: '○ ALERTAS DESATIVADOS NESTE DISPOSITIVO', detalhe: 'Ative para receber avisos de prazo aqui.' },
  bloqueado: {
    rotulo: '× NOTIFICAÇÕES BLOQUEADAS',
    detalhe: 'O navegador está bloqueando este site. Clique no ícone ao lado do endereço, libere "Notificações" e recarregue.',
  },
  requer_instalacao: {
    rotulo: '! INSTALE O APP PRIMEIRO',
    detalhe: 'No iPhone/iPad, notificações só funcionam com o Vigília na tela inicial: Compartilhar → Adicionar à Tela de Início. Depois abra por lá.',
  },
  sem_suporte: {
    rotulo: '× SEM SUPORTE NESTE ACESSO',
    detalhe: 'Este navegador ou endereço não permite push. É preciso HTTPS (ou localhost) e um navegador atual.',
  },
  sem_chave: { rotulo: '× CHAVE VAPID AUSENTE', detalhe: 'Defina VITE_VAPID_PUBLIC_KEY no .env e reinicie o servidor.' },
}

export function Notificacoes({ onFechar }: { onFechar: () => void }) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [estado, setEstado] = useState<EstadoPush | null>(null)
  const [dispositivos, setDispositivos] = useState<InscricaoPush[]>([])
  const [meuEndpoint, setMeuEndpoint] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  const atualizar = useCallback(async () => {
    setEstado(await estadoPush())
    setMeuEndpoint(await endpointAtual())
    try {
      setDispositivos(await listarDispositivos())
    } catch {
      /* offline: mantém lista anterior */
    }
  }, [])

  useEffect(() => {
    const el = dialogo.current
    if (el && !el.open) el.showModal()
    el?.focus()
    void atualizar()
  }, [atualizar])

  async function executar(acao: () => Promise<string | void>) {
    setOcupado(true)
    setMsg(null)
    try {
      const texto = await acao()
      if (texto) setMsg({ tipo: 'ok', texto })
    } catch (e) {
      setMsg({ tipo: 'erro', texto: e instanceof Error ? e.message : String(e) })
    } finally {
      setOcupado(false)
      void atualizar()
    }
  }

  const fechar = () => dialogo.current?.close()
  const info = estado ? TEXTO[estado] : null

  return (
    <dialog
      ref={dialogo}
      className={d.dialogo}
      tabIndex={-1}
      onClose={onFechar}
      onClick={(e) => e.target === dialogo.current && fechar()}
      aria-labelledby="notif-titulo"
    >
      <div className={d.form}>
        <div className={d.topo}>
          <span className="mono" id="notif-titulo">CANAL DE ALERTAS</span>
          <button type="button" className={d.fechar} aria-label="Fechar" onClick={fechar}>×</button>
        </div>

        <h2 className={s.titulo}>Notificações</h2>

        {info ? (
          <div className={s.estado} data-estado={estado}>
            <span className="mono">{info.rotulo}</span>
            <span>{info.detalhe}</span>
          </div>
        ) : (
          <span className="mono">VERIFICANDO…</span>
        )}

        <div className={s.botoes}>
          {estado === 'inativo' && (
            <button className="btn btn--destaque" disabled={ocupado} onClick={() => executar(async () => {
              await ativarPush()
              return 'Alertas ativados. Envie um teste para conferir.'
            })}>
              Ativar neste dispositivo
            </button>
          )}
          {estado === 'ativo' && (
            <>
              <button className="btn btn--destaque" disabled={ocupado} onClick={() => executar(async () => {
                const r = await enviarTeste()
                return r.ok
                  ? `Teste enviado para ${r.ok} ${r.ok === 1 ? 'dispositivo' : 'dispositivos'}. Deve chegar em segundos.`
                  : 'Nenhum dispositivo aceitou o teste.'
              })}>
                {ocupado ? 'Transmitindo…' : 'Enviar teste'}
              </button>
              <button className="btn" disabled={ocupado} onClick={() => executar(async () => {
                await desativarPush()
                return 'Alertas desativados neste dispositivo.'
              })}>
                Desativar
              </button>
            </>
          )}
        </div>

        {msg && <p role="status" className={s.msg} data-tipo={msg.tipo}>{msg.texto}</p>}

        <section className={s.secao}>
          <span className="mono">QUANDO VOCÊ É AVISADO</span>
          <ul className={s.regras}>
            <li><strong>1h antes</strong> de tarefas com horário</li>
            <li><strong>8h do dia</strong> para tarefas de dia inteiro</li>
            <li><strong>20h da véspera</strong> de provas e entregas</li>
            <li><strong>7h30</strong> — resumo do que vence hoje e do que está atrasado</li>
          </ul>
          <span className={s.nota}>A central verifica a cada 5 minutos. Horários no fuso deste dispositivo.</span>
        </section>

        {dispositivos.length > 0 && (
          <section className={s.secao}>
            <span className="mono">DISPOSITIVOS COM ALERTA ({dispositivos.length})</span>
            {dispositivos.map((x) => {
              const este = x.endpoint === meuEndpoint
              return (
                <div key={x.id} className={s.dispositivo}>
                  <span>
                    {x.dispositivo ?? 'Dispositivo'}
                    {este && <span className={s.este}> · ESTE</span>}
                  </span>
                  {!este && (
                    <button className={s.remover} disabled={ocupado} onClick={() => executar(async () => {
                      await removerDispositivo(x.id)
                      return 'Dispositivo removido.'
                    })}>
                      Remover
                    </button>
                  )}
                </div>
              )
            })}
          </section>
        )}
      </div>
    </dialog>
  )
}
