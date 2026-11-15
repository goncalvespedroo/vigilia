# Vigília — Sistema de Operações

Gerenciador de tarefas pessoal do Pedro (estudante de Ciência da Computação), instalável como PWA no computador (uso principal) e no celular. Uso individual, custo zero.

## Stack
- Front-end: React + Vite + TypeScript + vite-plugin-pwa
- Estilo: CSS com variáveis (tokens abaixo); sem bibliotecas de componentes pesadas
- Backend: Supabase (plano gratuito) — Postgres, Auth, Realtime, Edge Functions, pg_cron
- Notificações: Web Push com chaves VAPID + Service Worker
- Hospedagem: Vercel ou Cloudflare Pages (plano gratuito)
- Nada que gere custo. Se uma solução exigir serviço pago, pare e pergunte.

## Identidade visual
Diretriz completa em `docs/design/DESIGN-DIRECTIVE.md`. Resumo: organização secreta, cinematográfica, escura, imersiva — arquivo confidencial + central de operações. Identidade própria, sem reproduzir símbolos de outras obras.

Tokens (CSS variables):
- `--bg #080D13` · `--surface #111C27` · `--surface-2 #1C3040` · `--border #1F3242` · `--border-strong #2E5268`
- `--text #D6DCE0` · `--text-2 #9AA3AA` (Dust Grey `#777D83` só em bordas/desativados — não passa contraste em texto)
- `--accent #A6D5E5` (ciano: elementos ativos; texto `#080D13` por cima) · `--success #397A98` · `--warning #B59A68` (também selos/classificação) · `--danger #792F3B` (só alertas; como fundo com texto `#D6DCE0`; texto vermelho sobre fundo escuro usa `#E08A96`)
- Fontes: Cinzel (títulos institucionais), Inter (texto e UI), JetBrains Mono (códigos, datas, metadados)
- Raios 6/8/10px, bordas 1px, fundo com brilho radial azul sutil + grão (feTurbulence, opacidade ~0,07)
- Hover: borda `#2E5268` + brilho azul suave; painéis entram subindo 6px em 0,5s; respeitar `prefers-reduced-motion`
- Alvos de toque ≥ 44px; contraste mínimo 4,5:1
- Vocabulário: Painel, Operações (projetos), Dossiês, Reuniões/Convocações, Calendário, Agentes (equipe), Cofre (finanças), Diretrizes (checklist do dia)
- Referências visuais: `design/painel.html` e `design/sistema-design.html`

## Domínio
- Áreas: Faculdade, Equipe (comunicação do projeto de extensão), TCC, Pessoal — personalizáveis
- Tarefa tem: título, área, tipo (tarefa, prova, entrega, trabalho_grupo, reunião), status (a_fazer, fazendo, feito), prazo, prioridade, responsável (membro da equipe), subtarefas
- Duas visualizações sobre os mesmos dados: Kanban e Checklist
- Tela "Hoje": atrasadas, vencendo hoje e próximas
- Registrar tarefa precisa ser muito rápido (só o título é obrigatório)

## Tabelas (Supabase)
areas, tarefas, membros, reunioes, lembretes, push_subscriptions, transacoes (fase 3).
Row Level Security em todas: `user_id = auth.uid()`.

## Fases
1. MVP: login, áreas, tarefas, Kanban + Checklist, tela Hoje, Painel, push (desktop e celular), sincronização via Realtime, leitura offline
2. Equipe (membros, entregas por pessoa), reuniões com pauta, subtarefas
3. Cofre: importar extrato CSV e OFX, categorias, resumo mensal

## Regras de trabalho
- Trabalhe uma fase por vez; ao fim de cada etapa, diga o que testar.
- Chaves (Supabase, VAPID) só em `.env`, nunca no código. Mantenha um `.env.example`.
- Migrações SQL versionadas em `supabase/migrations/`.
- Interface e textos em português do Brasil.
- Atualizações do PWA: `registerType: 'autoUpdate'` (vite-plugin-pwa), checagem de versão nova a cada 1 hora (`registration.update()`). Nunca recarregar enquanto o usuário estiver digitando ou com formulário/diálogo aberto — esperar sair do campo, fechar o diálogo ou a janela ir para segundo plano. Após recarregar, aviso discreto: "Sistema atualizado para a versão X". Lógica em `src/lib/atualizacao.ts`.
