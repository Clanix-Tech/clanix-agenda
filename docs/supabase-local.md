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

Observação: as portas foram deslocadas (API 44321, banco 44322, Studio 44323, Inbucket 44324) para a pilha rodar junto de outro projeto Supabase local. URLs e chaves reais vêm sempre de `npx supabase status`.

Por que 4432x: depois de reiniciar, o Windows reserva blocos da faixa dinâmica de portas (a partir de 49152 e blocos como 55248-55447, usados por Hyper-V/WinNAT), e o Docker não consegue publicar portas dentro deles ("An attempt was made to access a socket in a way forbidden by its access permissions"). Por isso a pilha usa portas abaixo dessa faixa. Para conferir os blocos reservados: `netsh interface ipv4 show excludedportrange protocol=tcp`.

## Edge Functions e lembretes (Web Push)

A pilha local sobe o `edge_runtime` (`[edge_runtime] enabled = true` em `supabase/config.toml`) e serve `supabase/functions/*` em `http://127.0.0.1:44321/functions/v1/<nome>`. A função `send-reminders` tem `verify_jwt = false`: quem chama é o `pg_cron`, autenticado pelo header `x-cron-secret`.

Primeira vez (ou depois de apagar `supabase/functions/.env`):

1. `npm run vapid:gerar` grava `supabase/functions/.env` com `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (placeholder `mailto:contato@exemplo.com`) e `CRON_SECRET` aleatório. O arquivo é ignorado pelo git (`git check-ignore supabase/functions/.env`) e o script não o sobrescreve sem `-- --forcar`. Ele imprime a linha `VITE_VAPID_PUBLIC_KEY=...` para copiar no `.env.local`.
2. `npx supabase stop` e `npx supabase start` (sempre a partir deste repositório, nunca `--all`). O `supabase start` carrega `supabase/functions/.env` automaticamente no container do edge runtime; não é preciso `supabase functions serve --env-file`. As variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetadas pelo próprio runtime (localmente não há `SUPABASE_SECRET_KEYS`; a função usa a chave nova quando existir e a service role legada como reserva).
3. `npm run lembretes:local` grava no Vault local a URL da função e o `CRON_SECRET` (via `set_reminder_config`, com a chave secreta lida de `npx supabase status -o json` só no processo Node). A partir daí o cron chama a função a cada minuto.

Depois de `npm run db:reset` ou `npm run db:test`, rode `npm run lembretes:local` de novo: o reset apaga o Vault. Depois de editar código em `supabase/functions`, reinicie a pilha (ou só o container `supabase_edge_runtime_clanix-agenda`): no Windows a mudança de arquivo não chega ao container e o runtime continua com o código antigo. Função nova (pasta nova em `supabase/functions`) só passa a ser servida depois de `npx supabase stop` + `npx supabase start`: reiniciar só o container mantém a lista de funções montada no `start` (a nova responde 404).

A função `send-test-notification` (botão "Enviar notificação de teste" em Ajustes › Notificações) tem `verify_jwt = true`: o app a chama com o JWT do usuário, e ela lê e apaga só os aparelhos do próprio usuário (cliente do usuário, sob RLS). Para o app local ativar lembretes, copie a linha `VITE_VAPID_PUBLIC_KEY=...` impressa pelo `npm run vapid:gerar` para o `.env.local`. Push só funciona no build (`npm run build && npm run preview`): no `vite dev` não há service worker e a tela mostra "Este navegador não recebe notificações.".

URL que o banco alcança: o `pg_net` roda dentro do container do banco, então `127.0.0.1` não serve. Conferido com `net.http_post` + `net._http_response` (CLI 2.122, Docker Desktop no Windows): tanto `http://host.docker.internal:44321/functions/v1/send-reminders` quanto `http://supabase_kong_clanix-agenda:8000/functions/v1/send-reminders` respondem. O script usa a primeira (porta tirada de `API_URL`); a segunda é a alternativa se o Docker não tiver `host.docker.internal` (ex.: Docker Engine no Linux).

Conferir o cron: `select status_code, content from net._http_response order by id desc limit 3;` no banco local deve mostrar `200` e `{"due":0,...}` a cada minuto.

## Aviso sobre `seed.sql`

`supabase/seed.sql` contém apenas helpers de teste (schema `tests`), carregados só no banco local. Não há dados fictícios.

## Conta de teste com dados fictícios (só local)

`npm run dados:teste` (`scripts/dados-teste-local.mjs`) apaga e recria a conta `teste@clanix.local` (senha `clanix-teste-123`) com perfil, expediente (seg–sex 09–12 e 13–19, sáb 09–14), 5 serviços favoritos e atendimentos de 10 dias atrás até 14 dias à frente (concluídos, faltas, cancelados e agendados), todos criados pelas RPCs reais. Recusa qualquer URL que não seja `127.0.0.1`/`localhost`. Rode de novo depois de `db:reset`/`db:test` (o reset apaga a conta). Os dados ficam fora do `seed.sql` de propósito: o seed não pode ter dados fictícios porque os testes pgTAP partem de um banco vazio.
