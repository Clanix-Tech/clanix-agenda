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
- `npm run test:integration` — testes via API (RLS e concorrência); exige o Supabase local em execução
- `npm run db:types` — gera `src/types/database.ts`

Detalhes em `docs/banco-de-dados.md` e `docs/supabase-local.md`.

### Testes ponta a ponta

- `npm run e2e` — Playwright em computador (Chrome), iPhone (WebKit) e Android (Chrome); exige o
  Supabase local em execução e, uma vez por máquina, `npx playwright install chromium webkit`
- `npm run e2e:ui` — o mesmo, no modo interativo do Playwright

Como rodar cada camada de teste e o que cada uma cobre: `docs/guia-de-testes.md`.
