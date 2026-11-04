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

## Edge Functions e lembretes (Web Push)

A pilha local sobe o `edge_runtime` (`[edge_runtime] enabled = true` em `supabase/config.toml`) e serve `supabase/functions/*` em `http://127.0.0.1:55321/functions/v1/<nome>`. A função `send-reminders` tem `verify_jwt = false`: quem chama é o `pg_cron`, autenticado pelo header `x-cron-secret`.

Primeira vez (ou depois de apagar `supabase/functions/.env`):

1. `npm run vapid:gerar` grava `supabase/functions/.env` com `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (placeholder `mailto:contato@exemplo.com`) e `CRON_SECRET` aleatório. O arquivo é ignorado pelo git (`git check-ignore supabase/functions/.env`) e o script não o sobrescreve sem `-- --forcar`. Ele imprime a linha `VITE_VAPID_PUBLIC_KEY=...` para copiar no `.env.local`.
2. `npx supabase stop` e `npx supabase start` (sempre a partir deste repositório, nunca `--all`). O `supabase start` carrega `supabase/functions/.env` automaticamente no container do edge runtime; não é preciso `supabase functions serve --env-file`. As variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetadas pelo próprio runtime (localmente não há `SUPABASE_SECRET_KEYS`; a função usa a chave nova quando existir e a service role legada como reserva).
3. `npm run lembretes:local` grava no Vault local a URL da função e o `CRON_SECRET` (via `set_reminder_config`, com a chave secreta lida de `npx supabase status -o json` só no processo Node). A partir daí o cron chama a função a cada minuto.

Depois de `npm run db:reset` ou `npm run db:test`, rode `npm run lembretes:local` de novo: o reset apaga o Vault. Depois de editar código em `supabase/functions`, reinicie a pilha (ou só o container `supabase_edge_runtime_agenda-em-ordem`): no Windows a mudança de arquivo não chega ao container e o runtime continua com o código antigo.

URL que o banco alcança: o `pg_net` roda dentro do container do banco, então `127.0.0.1` não serve. Conferido com `net.http_post` + `net._http_response` (CLI 2.122, Docker Desktop no Windows): tanto `http://host.docker.internal:55321/functions/v1/send-reminders` quanto `http://supabase_kong_agenda-em-ordem:8000/functions/v1/send-reminders` respondem. O script usa a primeira (porta tirada de `API_URL`); a segunda é a alternativa se o Docker não tiver `host.docker.internal` (ex.: Docker Engine no Linux).

Conferir o cron: `select status_code, content from net._http_response order by id desc limit 3;` no banco local deve mostrar `200` e `{"due":0,...}` a cada minuto.

## Aviso sobre `seed.sql`

`supabase/seed.sql` contém apenas helpers de teste (schema `tests`), carregados só no banco local. Não há dados fictícios.
