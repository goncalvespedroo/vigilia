import type { Area, Membro, TarefaPrioridade, TarefaTipo } from '../types/database'
import { inicioDoDia, montarPrazo, somarDias } from './prazo'

/**
 * Registro rápido: o texto vira título e algumas marcações opcionais.
 *   #tcc          → área (pelo começo do nome ou pelo código: #0012)
 *   @amanhã 14h   → prazo (@hoje, @amanhã, @sex, @20/11, @14h, @14:30)
 *   ! / !!        → prioridade alta / máxima
 *   /prova        → tipo (/prova, /entrega, /grupo, /reuniao)
 *   +ana          → responsável (agente da equipe, pelo começo do nome)
 */
export interface Captura {
  titulo: string
  area?: Area
  responsavel?: Membro
  prazo?: { prazo: string; prazo_dia_inteiro: boolean }
  prioridade?: TarefaPrioridade
  tipo?: TarefaTipo
}

const normalizar = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const soAlfanumerico = (s: string) => s.replace(/[^a-z0-9]/g, '')

const DIAS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']
const TIPOS: Record<string, TarefaTipo> = {
  tarefa: 'tarefa',
  prova: 'prova',
  entrega: 'entrega',
  grupo: 'trabalho_grupo',
  reuniao: 'reuniao',
}

function lerHora(q: string) {
  const m = q.match(/^(\d{1,2})(?:h(\d{2})?|:(\d{2}))$/)
  if (!m) return undefined
  const h = Number(m[1])
  const min = Number(m[2] ?? m[3] ?? 0)
  return h < 24 && min < 60 ? { h, m: min } : undefined
}

function lerDia(q: string, agora: Date) {
  const hoje = inicioDoDia(agora)
  if (q === 'hoje') return hoje
  if (q === 'amanha') return somarDias(hoje, 1)

  const nomeDia = q.replace(/-?feira$/, '')
  if (nomeDia.length >= 3) {
    const i = DIAS.findIndex((d) => d.startsWith(nomeDia))
    if (i >= 0) {
      const diff = (i - hoje.getDay() + 7) % 7 || 7 // sempre a próxima ocorrência
      return somarDias(hoje, diff)
    }
  }

  const m = q.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/)
  if (m) {
    const dia = Number(m[1])
    let ano = m[3] ? Number(m[3]) : hoje.getFullYear()
    if (ano < 100) ano += 2000
    const d = new Date(ano, Number(m[2]) - 1, dia)
    if (d.getDate() !== dia) return undefined // 31/02 etc.
    if (!m[3] && d < hoje) d.setFullYear(ano + 1)
    return d
  }
  return undefined
}

export function interpretar(texto: string, areas: Area[], agora = new Date(), membros: Membro[] = []): Captura {
  const r: Captura = { titulo: '' }
  const resto: string[] = []
  let dia: Date | undefined
  let hora: { h: number; m: number } | undefined
  let aceitaHoraSolta = false

  for (const token of texto.trim().split(/\s+/).filter(Boolean)) {
    const n = normalizar(token)
    const podeHora = aceitaHoraSolta
    aceitaHoraSolta = false

    if (n.startsWith('#') && n.length > 1) {
      const q = n.slice(1)
      const qa = soAlfanumerico(q)
      const area =
        areas.find((a) => normalizar(a.nome).startsWith(q)) ??
        (qa ? areas.find((a) => a.codigo && soAlfanumerico(normalizar(a.codigo)).includes(qa)) : undefined)
      if (area) {
        r.area = area
        continue
      }
    }
    if (n.startsWith('+') && n.length > 1) {
      const q = n.slice(1)
      const membro = membros.find((m) => normalizar(m.nome).startsWith(q))
      if (membro) {
        r.responsavel = membro
        continue
      }
    }
    if (n === '!') {
      r.prioridade = 'alta'
      continue
    }
    if (/^!{2,}$/.test(n)) {
      r.prioridade = 'maxima'
      continue
    }
    if (n.startsWith('/')) {
      const tipo = TIPOS[n.slice(1)]
      if (tipo) {
        r.tipo = tipo
        continue
      }
    }
    if (n.startsWith('@') && n.length > 1) {
      const q = n.slice(1)
      const h = lerHora(q)
      if (h) {
        hora = h
        continue
      }
      const d = lerDia(q, agora)
      if (d) {
        dia = d
        aceitaHoraSolta = true // permite "@sex 14h"
        continue
      }
    }
    if (podeHora) {
      const h = lerHora(n)
      if (h) {
        hora = h
        continue
      }
    }
    resto.push(token)
  }

  if (hora && !dia) dia = inicioDoDia(agora)
  if (dia) r.prazo = montarPrazo(dia, hora)
  r.titulo = resto.join(' ')
  return r
}
