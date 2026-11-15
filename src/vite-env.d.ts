/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_VAPID_PUBLIC_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Data/hora em que o servidor de dev subiu ou o build foi gerado. */
declare const __BUILD__: string

/** Versão do package.json. */
declare const __VERSAO__: string
