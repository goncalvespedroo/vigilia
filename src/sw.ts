/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope

// App shell: tudo que o build gera fica disponível offline.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// SPA: qualquer navegação cai no index.html (inclusive offline).
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

// Google Fonts — CSS e arquivos de fonte.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({ cacheName: 'fontes-css' }),
)
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'fontes-arquivos',
    plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  }),
)

// autoUpdate: a versão nova assume assim que instalada. A página aberta segue
// com o JS antigo (já carregado) até o app decidir recarregar.
self.skipWaiting()
clientsClaim()

// ---------------------------------------------------------------------------
// Web Push
// ---------------------------------------------------------------------------
interface MensagemPush {
  titulo: string
  corpo: string
  url?: string
  tag?: string
}

self.addEventListener('push', (event) => {
  let m: MensagemPush = { titulo: 'Vigília', corpo: 'Nova mensagem da central.' }
  try {
    if (event.data) m = { ...m, ...(event.data.json() as Partial<MensagemPush>) }
  } catch {
    if (event.data) m.corpo = event.data.text()
  }
  event.waitUntil(
    self.registration.showNotification(m.titulo, {
      body: m.corpo,
      tag: m.tag,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      lang: 'pt-BR',
      data: { url: m.url ?? '/' },
    }),
  )
})

// Clique na notificação: foca uma janela aberta do app ou abre uma nova.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destino = new URL((event.notification.data as { url?: string } | null)?.url ?? '/', self.location.origin).href
  event.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const j of janelas) {
        if (new URL(j.url).origin === self.location.origin) {
          await j.focus()
          if ('navigate' in j) await (j as WindowClient).navigate(destino)
          return
        }
      }
      await self.clients.openWindow(destino)
    })(),
  )
})
