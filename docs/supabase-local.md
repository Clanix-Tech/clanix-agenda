# Supabase local

## Pré-requisitos

- Docker Desktop em execução.
- Node e dependências instaladas (`npm install`).

## Comandos

- `npm run db:start` sobe a pilha local (a primeira vez baixa várias imagens).
- `npm run db:stop` para a pilha.
- `npm run db:reset` recria o banco aplicando migrações e `seed.sql`.
- `npm run db:test` recria o banco e roda os testes pgTAP (`supabase test db`).

## URLs e chaves locais

Rode `npx supabase status` (ou `npx supabase status -o env`) para ver URLs e chaves. Não grave chaves no repositório.

Observação: as portas foram deslocadas em +1000 (API 55321, banco 55322, Studio 55323, Inbucket 55324) para a pilha rodar junto de outro projeto Supabase local. URLs e chaves reais vêm sempre de `npx supabase status`.

## Aviso sobre `seed.sql`

`supabase/seed.sql` contém apenas helpers de teste (schema `tests`), carregados só no banco local. Não há dados fictícios.
