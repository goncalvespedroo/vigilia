import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const agora = new Date()
const dd = (n: number) => String(n).padStart(2, '0')
const BUILD = `${dd(agora.getDate())}.${dd(agora.getMonth() + 1)} ${dd(agora.getHours())}:${dd(agora.getMinutes())}`

export default defineConfig({
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [
    react(),
    VitePWA({
      // Service worker próprio (src/sw.ts): precisamos dele para Web Push.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      pwaAssets: { disabled: false, config: true },
      manifest: {
        name: 'Vigília — Sistema de Operações',
        short_name: 'Vigília',
        description: 'Gerenciador de operações, prazos e diretrizes.',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0B0B0A',
        theme_color: '#0B0B0A',
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },
    }),
  ],
})
