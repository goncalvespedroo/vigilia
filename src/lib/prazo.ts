import type { Tarefa } from '../types/database'

const DIA = 86_400_000
const SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
const dd = (n: number) => String(n).padStart(2, '0')

export function inicioDoDia(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function somarDias(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** Diferença em dias de calendário (b − a), robusta a horário de verão. */
export function diasEntre(a: Date, b: Date) {
  return Math.round((inicioDoDia(b).getTime() - inicioDoDia(a).getTime()) / DIA)
}

export type Situacao = 'concluida' | 'atrasada' | 'hoje' | 'proxima' | 'futura' | 'sem_prazo'

export function situacao(t: Pick<Tarefa, 'prazo' | 'status'>, agora = new Date()): Situacao {
  if (t.status === 'feito') return 'concluida'
  if (!t.prazo) return 'sem_prazo'
  const p = new Date(t.prazo)
  if (p < agora) return 'atrasada'
  const d = diasEntre(agora, p)
  if (d === 0) return 'hoje'
  if (d <= 7) return 'proxima'
  return 'futura'
}

export function formatarPrazo(prazo: string, diaInteiro: boolean, agora = new Date()) {
  const p = new Date(prazo)
  const d = diasEntre(agora, p)
  let dia: string
  if (d === 0) dia = 'HOJE'
  else if (d === 1) dia = 'AMANHÃ'
  else if (d === -1) dia = 'ONTEM'
  else if (d > 1 && d < 7) dia = `${SEMANA[p.getDay()]} ${dd(p.getDate())}/${dd(p.getMonth() + 1)}`
  else dia = `${dd(p.getDate())}/${dd(p.getMonth() + 1)}${p.getFullYear() !== agora.getFullYear() ? `/${p.getFullYear()}` : ''}`
  return diaInteiro ? dia : `${dia} · ${dd(p.getHours())}:${dd(p.getMinutes())}`
}

/** Sem hora = "dia inteiro": guardado como 23:59:59 do horário local. */
export function montarPrazo(dia: Date, hora?: { h: number; m: number }) {
  const x = new Date(dia)
  if (hora) {
    x.setHours(hora.h, hora.m, 0, 0)
    return { prazo: x.toISOString(), prazo_dia_inteiro: false }
  }
  x.setHours(23, 59, 59, 0)
  return { prazo: x.toISOString(), prazo_dia_inteiro: true }
}

/** Converte para os valores de <input type="date"> e <input type="time">. */
export function prazoParaCampos(prazo: string | null, diaInteiro: boolean) {
  if (!prazo) return { data: '', hora: '' }
  const p = new Date(prazo)
  return {
    data: `${p.getFullYear()}-${dd(p.getMonth() + 1)}-${dd(p.getDate())}`,
    hora: diaInteiro ? '' : `${dd(p.getHours())}:${dd(p.getMinutes())}`,
  }
}

export function camposParaPrazo(data: string, hora: string) {
  if (!data) return { prazo: null, prazo_dia_inteiro: false }
  const [a = 0, m = 1, d = 1] = data.split('-').map(Number)
  const base = new Date(a, m - 1, d)
  if (!hora) return montarPrazo(base)
  const [h = 0, mi = 0] = hora.split(':').map(Number)
  return montarPrazo(base, { h, m: mi })
}
