import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { InscricaoPush } from '../types/database'

const CHAVE_PUBLICA = import.meta.env.VITE_VAPID_PUBLIC_KEY

export type EstadoPush =
  | 'sem_chave' // VITE_VAPID_PUBLIC_KEY ausente
  | 'sem_suporte' // navegador sem Push API ou página sem HTTPS
  | 'requer_instalacao' // iPhone/iPad: só funciona com o app instalado na tela inicial
  | 'bloqueado' // permissão negada no navegador
  | 'inativo'
  | 'ativo'

function chaveEmBytes(b64url: string) {
  const b64 = (b64url + '='.repeat((4 - (b64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

function mesmaChave(sub: PushSubscription) {
  const atual = sub.options.applicationServerKey
  if (!atual) return false
  const a = new Uint8Array(atual)
  const b = chaveEmBytes(CHAVE_PUBLICA ?? '')
  return a.length === b.length && a.every((x, i) => x === b[i])
}

const suportaPush = () =>
  window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

function iosSemInstalar() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const instalado =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  return ios && !instalado
}

/** Registro do service worker, com limite de espera (em dev ele pode demorar). */
async function registro(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return undefined
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<undefined>((r) => setTimeout(() => r(undefined), 4000)),
  ])
}

/** Rótulo curto do dispositivo, ex.: "Chrome · Linux". */
export function rotuloDispositivo(ua = navigator.userAgent) {
  const nav = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navegador'
  const so = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'outro sistema'
  return `${nav} · ${so}`
}

export async function estadoPush(): Promise<EstadoPush> {
  if (!CHAVE_PUBLICA) return 'sem_chave'
  if (iosSemInstalar()) return 'requer_instalacao'
  if (!suportaPush()) return 'sem_suporte'
  if (Notification.permission === 'denied') return 'bloqueado'
  const reg = await registro()
  if (!reg) return 'sem_suporte'
  const sub = await reg.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' && mesmaChave(sub) ? 'ativo' : 'inativo'
}

async function salvarInscricao(sub: PushSubscription) {
  const j = sub.toJSON()
  if (!j.endpoint || !j.keys?.p256dh || !j.keys.auth) throw new Error('Inscrição de push incompleta.')
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      endpoint: j.endpoint,
      p256dh: j.keys.p256dh,
      auth: j.keys.auth,
      fuso: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
      dispositivo: rotuloDispositivo(),
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw new Error(`Não foi possível registrar o dispositivo: ${error.message}`)
}

/** Pede permissão, inscreve este navegador e registra no banco. */
export async function ativarPush() {
  if (!CHAVE_PUBLICA) throw new Error('Chave VAPID pública ausente no .env.')
  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') {
    throw new Error(
      permissao === 'denied'
        ? 'Permissão negada. Libere as notificações nas configurações do site (ícone ao lado do endereço).'
        : 'Permissão não concedida.',
    )
  }
  const reg = await registro()
  if (!reg) throw new Error('Service worker indisponível. Recarregue a página e tente de novo.')
  let sub = await reg.pushManager.getSubscription()
  if (sub && !mesmaChave(sub)) {
    // Chave VAPID trocada: a inscrição antiga não serve mais.
    await sub.unsubscribe()
    sub = null
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveEmBytes(CHAVE_PUBLICA) })
  await salvarInscricao(sub)
}

/** Cancela a inscrição deste navegador e remove do banco. */
export async function desativarPush() {
  const sub = await (await registro())?.pushManager.getSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

/** Mantém o registro do banco em dia (fuso, rótulo) quando o push já está ativo. */
export async function sincronizarPush() {
  try {
    if ((await estadoPush()) !== 'ativo') return
    const sub = await (await registro())?.pushManager.getSubscription()
    if (sub) await salvarInscricao(sub)
  } catch (e) {
    console.warn('[Vigília] sincronizarPush', e)
  }
}

export async function endpointAtual() {
  return (await (await registro())?.pushManager.getSubscription())?.endpoint ?? null
}

export async function listarDispositivos(): Promise<InscricaoPush[]> {
  const { data, error } = await supabase.from('push_subscriptions').select('*').order('created_at')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function removerDispositivo(id: string) {
  const { error } = await supabase.from('push_subscriptions').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** Pede à Edge Function uma notificação de teste para todos os dispositivos. */
export async function enviarTeste() {
  const { data, error } = await supabase.functions.invoke<{ dispositivos: number; ok: number; removidas: number }>('lembretes', {
    body: { teste: true },
  })
  if (error) {
    let detalhe = error.message
    if (error instanceof FunctionsHttpError) {
      try {
        detalhe = ((await error.context.json()) as { erro?: string }).erro ?? detalhe
      } catch {
        /* resposta sem JSON */
      }
    }
    throw new Error(detalhe.includes('Failed to send') ? 'Função "lembretes" não encontrada — ela já foi publicada?' : detalhe)
  }
  return data!
}
