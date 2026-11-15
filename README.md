# Vigília — Sistema de Operações

Gerenciador de tarefas pessoal (PWA): operações, tarefas em Kanban/Checklist, tela Hoje,
equipe com cobrança por WhatsApp, reuniões com pauta e ata. React + Vite + TypeScript + Supabase.

## Rodar localmente

```bash
npm install
cp .env.example .env   # preencha com a URL e a chave pública do Supabase
npm run dev            # http://localhost:5173
```

## Banco (Supabase)

Migrações versionadas em `supabase/migrations/`. Com a CLI linkada ao projeto:

```bash
npx supabase db push --remote
```

## Publicação (Cloudflare Pages)

- Build: `npm run build` · saída: `dist` · Node 22 (`.nvmrc`)
- Variáveis de ambiente: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`
- Cabeçalhos de cache e segurança em `public/_headers`
- No Supabase, adicione a URL publicada em *Authentication → URL Configuration*

## Notificações push (opcional)

Função em `supabase/functions/lembretes`. Secrets em `supabase/functions/.env` (fora do git; modelo em `.env.example`).

```bash
npx supabase secrets set --env-file supabase/functions/.env
npx supabase functions deploy lembretes --no-verify-jwt --use-api
```

Depois, uma única vez, grave no Vault a URL da função e o segredo do agendador
(`vigilia_url_funcao` e `vigilia_cron_secret` — ver a migração `*_push_lembretes.sql`).
