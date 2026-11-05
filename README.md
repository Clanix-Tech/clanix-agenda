# Agenda em Ordem

PWA em português do Brasil para profissionais de beleza organizarem seus atendimentos.
Frontend em React + Vite + TypeScript; backend no Supabase.

## Comandos

- `npm run dev` — servidor de desenvolvimento
- `npm run build` — build de produção
- `npm run typecheck` — checagem de tipos
- `npm run lint` — ESLint
- `npm run format` — formata o código com Prettier
- `npm test` — testes unitários (Vitest)

Copie `.env.example` para `.env.local` e preencha as variáveis do Supabase.

### Banco de dados

- `npm run db:start` / `npm run db:stop` — sobe/para o Supabase local
- `npm run db:reset` — recria o banco com migrações e seed
- `npm run db:test` — reset + testes pgTAP
- `npm run test:integration` — testes via API (RLS, concorrência e a Edge Function `send-reminders`);
  exige o Supabase local em execução
- `npm run db:types` — gera `src/types/database.ts`

Detalhes em `docs/banco-de-dados.md` e `docs/supabase-local.md`.

### Lembretes (notificações push)

- `npm run vapid:gerar` — gera as chaves VAPID e o `CRON_SECRET` locais em `supabase/functions/.env`
  (ignorado pelo git) e imprime a linha `VITE_VAPID_PUBLIC_KEY=...` para o `.env.local`; depois,
  reinicie o Supabase local
- `npm run lembretes:local` — grava no Vault local a URL da função e o segredo do cron; rode de novo
  depois de cada `db:reset`/`db:test`

Como funciona, configuração em produção, limites e privacidade: `docs/notificacoes.md`. Roteiro em
aparelhos reais: `docs/checklist-aparelhos.md`. APK Android: `docs/guia-apk-android.md`.

### Publicação e segurança

- `npm run verificar:producao` — confere variáveis, build e bundle (sem segredos) do `.env.production.local`
- `npm run publicar:site` — verifica e publica o site no Cloudflare Pages (upload direto)
- `npm run backup:producao` — backup do banco de produção (precisa do `.env.backup.local`)

Passo a passo para quem nunca publicou: `docs/publicacao.md`. Mapa de segurança (requisito → onde →
teste): `docs/seguranca.md`. Conferências antes de abrir ao público: `docs/checklist-lancamento.md`.
Backup, restauração e projeto sempre ativo: `docs/backup-e-restauracao.md`. Privacidade e retenção:
`docs/privacidade-e-retencao.md`.

### Testes ponta a ponta

- `npm run e2e` — Playwright em computador (Chrome), iPhone (WebKit), Android (Chrome) e no build com
  service worker; exige o Supabase local em execução e, uma vez por máquina,
  `npx playwright install chromium webkit` (os testes de lembretes precisam do `npm run vapid:gerar`;
  sem ele, são pulados)
- `npm run e2e:ui` — o mesmo, no modo interativo do Playwright

Como rodar cada camada de teste e o que cada uma cobre: `docs/guia-de-testes.md`.
