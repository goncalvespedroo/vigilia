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
Estética de "organização secreta": terminal confidencial, dossiês, códigos de operação. Tema escuro.

- Fundo `#0B0B0A` · painel `#141412` · painel 2 `#1B1A17` · borda `#2B2925`
- Texto `#ECE7DC` · texto secundário `#9C968A`
- Destaque `#E5484D` (texto escuro `#0B0B0A` por cima) · em andamento `#E2A336`
- Fontes: Space Grotesk (interface), IBM Plex Mono (metadados, códigos), Special Elite (só carimbos)
- Cards com raio 18px, botões em pílula, alvos de toque ≥ 44px
- Vocabulário: Painel, Operações (projetos), Dossiês, Reuniões/Convocações, Calendário, Agentes (equipe), Cofre (finanças), Diretrizes (checklist do dia)
- Referência visual: `design/painel.html`

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
