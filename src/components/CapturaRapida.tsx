import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useDados } from '../lib/dados'
import { interpretar } from '../lib/captura'
import { formatarPrazo, inicioDoDia, montarPrazo } from '../lib/prazo'
import { PRIORIDADE, TIPO } from '../lib/rotulos'
import s from './CapturaRapida.module.css'

/** Campo de registro rápido. Atalho: tecla N em qualquer lugar da tela. */
interface Props {
  areaPadrao?: string | null
  /** Sem @prazo explícito, a tarefa vence hoje (tela Hoje). */
  paraHoje?: boolean
  /** Sem @prazo explícito, a tarefa vence neste dia (Calendário). */
  diaPadrao?: Date
  /** Versão menor, sem dicas — para caber em cards. */
  compacta?: boolean
  /** Encaminhamento de reunião: a tarefa nasce ligada a ela. */
  reuniaoId?: string
  placeholder?: string
  /** Foca o campo ao montar (janela de nova missão). */
  autoFoco?: boolean
  /** Chamado com o título depois de registrar. */
  aoRegistrar?: (titulo: string) => void
}

export function CapturaRapida({ areaPadrao, paraHoje, diaPadrao, compacta, reuniaoId, placeholder, autoFoco, aoRegistrar }: Props) {
  const { areas, membros, criarTarefa, semRede } = useDados()
  const [texto, setTexto] = useState('')
  const campo = useRef<HTMLInputElement>(null)
  const ativas = useMemo(() => areas.filter((a) => !a.arquivada), [areas])
  const agentes = useMemo(() => membros.filter((m) => m.ativo), [membros])
  const cap = useMemo(() => {
    const r = interpretar(texto, ativas, new Date(), agentes)
    const dia = diaPadrao ?? (paraHoje ? new Date() : null)
    if (dia && !r.prazo && r.titulo) r.prazo = montarPrazo(inicioDoDia(dia))
    return r
  }, [texto, ativas, agentes, paraHoje, diaPadrao])

  useEffect(() => {
    if (autoFoco) return // dentro de janela: o atalho N é da página
    function tecla(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== 'n' || e.ctrlKey || e.metaKey || e.altKey) return
      const alvo = e.target as HTMLElement
      if (alvo.closest('input, textarea, select, [contenteditable], dialog[open]')) return
      e.preventDefault()
      campo.current?.focus()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [autoFoco])

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (!cap.titulo) return
    void criarTarefa({
      titulo: cap.titulo,
      area_id: cap.area?.id ?? areaPadrao ?? null,
      responsavel_id: cap.responsavel?.id ?? null,
      reuniao_id: reuniaoId ?? null,
      tipo: cap.tipo,
      prioridade: cap.prioridade,
      ...cap.prazo,
    })
    // Offline a tarefa não é criada: mantém o texto para tentar de novo depois.
    if (!semRede) {
      setTexto('')
      aoRegistrar?.(cap.titulo)
    }
  }

  const reconhecido = [
    cap.area && { chave: 'area', texto: cap.area.nome.toUpperCase(), cor: cap.area.cor },
    cap.responsavel && { chave: 'resp', texto: `▸ ${cap.responsavel.nome.toUpperCase()}` },
    cap.prazo && { chave: 'prazo', texto: formatarPrazo(cap.prazo.prazo, cap.prazo.prazo_dia_inteiro) },
    cap.prioridade && { chave: 'prio', texto: `PRIORIDADE ${PRIORIDADE[cap.prioridade].toUpperCase()}` },
    cap.tipo && { chave: 'tipo', texto: TIPO[cap.tipo].toUpperCase() },
  ].filter(Boolean) as { chave: string; texto: string; cor?: string | null }[]

  return (
    <form className={`${s.captura} ${compacta ? s.compacta : ''}`} onSubmit={enviar}>
      <label className={s.linha}>
        <span aria-hidden="true" className={s.mais}>+</span>
        <span className="sr">Registrar nova tarefa</span>
        <input
          ref={campo}
          autoFocus={autoFoco}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={placeholder ?? (paraHoje ? 'Registrar diretriz para hoje…  (N)' : 'Registrar nova missão…  (N)')}
          autoComplete="off"
          enterKeyHint="done"
        />
        <button type="submit" className="btn btn--destaque" disabled={!cap.titulo}>
          Registrar
        </button>
      </label>
      <div className={s.dicas} aria-live="polite">
        {reconhecido.length > 0 ? (
          reconhecido.map((r) => (
            <span key={r.chave} className="selo">
              {r.cor && <span className="ponto-area" style={{ background: r.cor }} />}
              {r.texto}
            </span>
          ))
        ) : compacta ? null : (
          <span className="mono">#ÁREA · @AMANHÃ 14H · +AGENTE · ! ALTA · !! MÁXIMA · /PROVA</span>
        )}
      </div>
    </form>
  )
}
