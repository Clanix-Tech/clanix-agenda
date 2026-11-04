# Plano 03 — PWA, lembretes por notificação e APK Android — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o Agenda em Ordem um app instalável (iPhone, Android, Mac, Windows) que envia ao profissional um lembrete por notificação antes de cada atendimento, e preparar o APK Android (TWA) para distribuição direta.

**Architecture:** O banco decide **quais** lembretes estão devidos e monta o texto no fuso do perfil (funções SQL testadas com pgTAP); `pg_cron` chama a cada minuto, via `pg_net`, a Edge Function `send-reminders`, que só **reserva** cada lembrete (no máximo um envio por atendimento+horário), envia o Web Push com VAPID e limpa assinaturas expiradas. No navegador, um service worker próprio (vite-plugin-pwa, `injectManifest`) faz cache só dos arquivos do build e trata `push`/`notificationclick`; a tela Ajustes › Notificações ativa/desativa o aparelho, envia teste e guia a instalação no iPhone. O APK é um TWA (Bubblewrap) do mesmo site.

**Tech Stack:** o do Plano 02 + `vite-plugin-pwa` (estratégia `injectManifest`), `workbox-precaching`/`workbox-core` 7, `@vite-pwa/assets-generator` (ícones), Supabase Edge Functions (Deno) com `npm:web-push@3` e `npm:@supabase/supabase-js@2`, extensões `pg_cron` e `pg_net`, Supabase Vault. Conferir as versões estáveis atuais na documentação oficial antes de instalar.

**Spec:** `docs/superpowers/specs/2026-10-29-agenda-em-ordem-design.md` (§2, §3, §6.2, §6.3, §6.4, §6.5, §7, §8 Etapas 09–10, §9, §11) + requisitos `docs/superpowers/specs/2026-10-29-agenda-em-ordem-requisitos.md` + contrato do banco `docs/banco-de-dados.md`. Referência visual: `docs/design/telas/T09-Notificacoes-Celular.dc.html` (abrir e copiar medidas, cores e textos) e o estilo Painel em Blocos das demais telas.

**Branch:** criar `feat/plano-03-pwa-notificacoes` a partir de `master` (Planos 01 e 02 já estão na `master`).

**Fora deste plano:** exclusão de conta, política de privacidade, CAPTCHA, deploy em produção, Supabase Pro, provedor de e-mail, e2e no CI com build (Plano 04). Gerar e assinar o APK de verdade depende da verificação de desenvolvedor Google, do domínio e do keystore (pendências do usuário §11): aqui ficam a configuração, os scripts e o guia.

## Global Constraints

- Tudo do Plano 02 continua valendo: pt-BR, `DD/MM/AAAA`, 24 h, fuso do perfil como fonte de verdade, paleta e tipografia da marca, botões primários `#2563EB`, alvos ≥ 44 px, inputs ≥ 16 px no celular, foco visível, status com ícone + texto + cor, sem funcionalidade falsa, erros pelo contrato sem `details`/`hint`, RN17.
- Variáveis do frontend permitidas: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_VAPID_PUBLIC_KEY` (pública por natureza) e `VITE_APK_DOWNLOAD_URL` (opcional). Nada além disso.
- `VAPID_PRIVATE_KEY`, `CRON_SECRET` e a chave service role **só** nos secrets das Edge Functions / no Vault do banco. Localmente ficam em `supabase/functions/.env` (ignorado pelo git) e no Vault local, gerados por script — nunca em arquivo versionado, nunca no bundle.
- Lembrete (design §6.2): só para o **profissional**, em todos os aparelhos em que ele ativou; antecedência `reminder_minutes` ∈ {15, 30, 60} ou nulo = desligado; só status `agendado`; cancelado não avisa; remarcado segue o novo horário; lembrete cujo momento de aviso já tinha passado quando o horário foi marcado **não** é enviado.
- Texto do lembrete (decisão Claude sobre o título; corpo do design §6.2):
  - título: `Lembrete de atendimento`
  - corpo: `14:00 · Juliana Rocha — Escova e hidratação · em 30 min`
  - corpo com "Ocultar nome do cliente" ligado: `Atendimento às 14:00 · em 30 min` (sem nome **e** sem serviço)
  - minutos restantes = arredondamento para cima de `(starts_at − agora)` em minutos; `60` → `em 1 hora`; demais → `em N min`
  - nome do cliente cortado em 60 caracteres com `…`
  - toque abre `/?atendimento=<id>` (detalhes do atendimento).
- Pedido de permissão de notificação **só** a partir de um clique do usuário (exigência do iOS).
- Service worker faz cache **somente** dos arquivos estáticos do build; nada de respostas do Supabase/API em cache (design §6.3).
- Atualização de versão em modo `prompt`: aviso "Nova versão disponível" com botão "Atualizar".
- Nenhum dado de cliente em `localStorage`/`sessionStorage`/Cache Storage. Flags de interface (ex.: "não mostrar o aviso de instalação de novo") podem usar `localStorage`.
- Toda função SQL nova é `SECURITY DEFINER` com `set search_path = ''` e precisa de `GRANT EXECUTE` explícito (o revoke global de privilégios padrão está ativo); funções do backend (`due_reminders`, `claim_reminder`, `release_reminder`, `set_reminder_config`) só para `service_role`.
- Supabase local usa portas +1000 (API 55321, DB 55322, Studio 55323, Mailpit 55324). Nunca parar nem mexer no projeto `gceu-conecta` do usuário; comandos `supabase` só a partir deste repositório. Chaves sempre lidas em tempo de execução de `npx supabase status -o json`.

## Review Focus

1. **Mesmo navegador, duas contas** (A sai, B entra no mesmo aparelho): lembretes de A nunca chegam ao aparelho com B logado → teste de "claim" na Task 1 e de limpeza ao sair na Task 5.
2. **Atendimento remarcado ou cancelado depois do aviso, ou remarcado para dentro da janela de aviso**: novo aviso para o novo horário; cancelado nenhum; remarcado para daqui a 10 min com antecedência 30 → nenhum → testes pgTAP na Task 1.
3. **Execuções sobrepostas do cron ou função chamada duas vezes no mesmo minuto**: no máximo um push por (atendimento, horário) → teste de reserva na Task 1 e de handler na Task 3.
4. **Fuso do perfil diferente de UTC/servidor** (perfil `America/Manaus`, servidor em UTC): o horário do texto é o do perfil → teste pgTAP na Task 1.
5. **iPhone no Safari sem instalar, permissão negada ou navegador sem suporte**: a tela mostra o estado real e o caminho certo, nunca um botão que não funciona → testes na Task 5.

---

### Task 1: Banco — reservas de lembrete, texto no fuso do perfil e assinatura com "claim"

**Files:**
- Create: `supabase/migrations/20261104000100_reminders.sql`, `supabase/tests/database/09_reminders.test.sql`
- Modify: `src/types/database.ts` (regerar com `npm run db:types`), `docs/banco-de-dados.md` (tabelas, funções, privilégios, como testar)

**Interfaces:**
- Produces (todas `security definer`, `search_path = ''`):
  - coluna `appointments.reminder_anchor_at timestamptz not null default now()` — atualizada por trigger `before update` quando `starts_at` muda ou quando o status volta de `cancelado` para `agendado`; nas linhas existentes recebe `created_at`.
  - `public.register_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_device_label text default null) returns uuid` — para `authenticated`; `insert ... on conflict (endpoint) do update set owner_id = auth.uid(), p256dh, auth, device_label, last_used_at = now()`; exige `auth.uid()` (senão `42501`). Remove o `grant insert` direto em `push_subscriptions` (o navegador passa a gravar só por esta RPC).
  - `public.due_reminders(p_now timestamptz default now()) returns table (appointment_id uuid, owner_id uuid, starts_at timestamptz, title text, body text, url text)` — só `service_role`. Devido quando: `status = 'agendado'`, `profiles.reminder_minutes is not null`, `starts_at > p_now`, `starts_at - reminder_minutes * interval '1 minute' <= p_now`, `starts_at - reminder_minutes * interval '1 minute' >= reminder_anchor_at`, sem linha em `appointment_reminders` para `(id, starts_at)`, e o dono tem ao menos uma assinatura. Texto conforme Global Constraints, hora com `to_char(starts_at at time zone profiles.timezone, 'HH24:MI')`.
  - `public.claim_reminder(p_appointment_id uuid, p_starts_at timestamptz) returns boolean` — só `service_role`; `insert into appointment_reminders ... on conflict do nothing`; `true` só para quem inseriu.
  - `public.release_reminder(p_appointment_id uuid, p_starts_at timestamptz) returns void` — só `service_role`; apaga a reserva (usado quando nenhum aparelho recebeu por falha temporária).
  - índice `push_subscriptions (owner_id)` (pendência do Plano 01).

- [ ] **Step 1: Escrever `09_reminders.test.sql` (pgTAP) que falha**, com `tests.` helpers do seed para criar usuários/atendimentos e um `p_now` fixo. Casos (um `ok`/`is` cada):
  - perfil 30 min, atendimento 14:00 BRT marcado às 10:00: `due_reminders('…13:29-03')` vazio; `due_reminders('…13:30-03')` devolve 1 linha com `body = '14:00 · Juliana Rocha — Escova e hidratação · em 30 min'`, `title = 'Lembrete de atendimento'`, `url = '/?atendimento=' || id`.
  - `p_now` 13:45 → `body` termina em `· em 15 min`; perfil 60 e `p_now` 13:00 → `· em 1 hora`; `p_now` 13:59:30 → `em 1 min`.
  - `hide_client_name_in_notifications = true` → `body = 'Atendimento às 14:00 · em 30 min'`.
  - perfil `America/Manaus`, atendimento `2026-11-10T14:00-04:00`, sessão com `set timezone = 'UTC'` → texto `14:00`.
  - `reminder_minutes` nulo → vazio; status `cancelado`/`concluido` → vazio; dono sem assinatura → vazio.
  - marcado (anchor) às 13:50 para 14:00 com antecedência 30 → vazio em 13:51 (Review Focus 2).
  - depois de `claim_reminder` → vazio; remarcar para 16:00 → devido de novo em 15:30 com `16:00` no texto (Review Focus 2).
  - `claim_reminder` duas vezes no mesmo par → `true` depois `false` (Review Focus 3); `release_reminder` → `claim_reminder` volta a dar `true`.
  - reativar cancelado atualiza `reminder_anchor_at`; editar só observações não atualiza.
  - nome de 120 caracteres → corpo com 60 caracteres de nome terminando em `…`.
  - privilégios: `authenticated` não executa `due_reminders`/`claim_reminder`/`release_reminder` (`throws_ok … '42501'`); `authenticated` não faz `insert` direto em `push_subscriptions`.
  - claim (Review Focus 1): usuário A registra endpoint `https://push.example/abc`; usuário B chama `register_push_subscription` com o mesmo endpoint → a linha passa a ser de B, com as chaves novas; A não a vê mais por RLS.
  - `register_push_subscription` sem `auth.uid()` → `42501`; endpoint `http://…` → `23514`.
- [ ] **Step 2:** `npm run db:test` → FAIL (funções inexistentes).
- [ ] **Step 3:** Escrever a migração com as definições acima e os `grant execute` explícitos; regerar tipos (`npm run db:types`); atualizar `docs/banco-de-dados.md`.
- [ ] **Step 4:** `npm run db:test` → PASS (incluindo `08_invariants`, que exige `search_path` e grants corretos); `npm run test:integration` → PASS; `npm run typecheck` → PASS.
- [ ] **Step 5: Commit** — `feat(banco): lembretes devidos no fuso do perfil, reserva sem duplicar e assinatura por RPC`

### Task 2: Banco — agendamento por minuto com pg_cron + pg_net e configuração no Vault

**Files:**
- Create: `supabase/migrations/20261104000200_reminders_cron.sql`, `supabase/tests/database/10_reminders_cron.test.sql`
- Modify: `docs/banco-de-dados.md`

**Interfaces:**
- Consumes: nada da Task 1 em SQL (a função chamada é a Edge Function da Task 3).
- Produces:
  - extensões `pg_cron` e `pg_net` habilitadas, com os `grant` necessários (revoke global ativo).
  - `public.set_reminder_config(p_function_url text, p_cron_secret text) returns void` — só `service_role`; grava/atualiza no Vault os segredos `reminders_function_url` e `reminders_cron_secret` (`vault.create_secret` / `vault.update_secret`). Valida `p_function_url ~ '^https?://'` e `char_length(p_cron_secret) >= 32`.
  - `private.invoke_send_reminders() returns bigint` (schema `private`, sem acesso por API) — lê os dois segredos de `vault.decrypted_secrets`; se faltar algum, retorna `null` sem chamar nada; senão `net.http_post(url, body := '{}'::jsonb, headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', secret), timeout_milliseconds := 10000)` e retorna o id da requisição.
  - job `cron.schedule('send-reminders', '* * * * *', 'select private.invoke_send_reminders()')` (idempotente: desagendar antes se existir).

- [ ] **Step 1: Testes pgTAP que falham:** job `send-reminders` existe com agenda `* * * * *`; sem segredos `private.invoke_send_reminders()` retorna `null`; após `set_reminder_config('http://exemplo.local/functions/v1/send-reminders', repeat('x',32))` como `service_role` a função retorna um id não nulo e existe linha em `net.http_request_queue` com o header `x-cron-secret`; `set_reminder_config` com segredo de 10 caracteres → erro; `authenticated` não executa `set_reminder_config` nem `private.invoke_send_reminders` (`42501`).
- [ ] **Step 2:** `npm run db:test` → FAIL.
- [ ] **Step 3:** Escrever a migração; documentar no `docs/banco-de-dados.md` (como configurar URL e segredo local e em produção — produção: `https://<ref>.supabase.co/functions/v1/send-reminders`).
- [ ] **Step 4:** `npm run db:test` → PASS.
- [ ] **Step 5: Commit** — `feat(banco): cron por minuto chama o envio de lembretes com segredo no Vault`

### Task 3: Edge Function `send-reminders` (Web Push com VAPID) e scripts locais

**Files:**
- Create: `supabase/functions/_shared/webpush.ts`, `supabase/functions/send-reminders/handler.ts`, `supabase/functions/send-reminders/index.ts`, `supabase/functions/send-reminders/handler.test.ts`, `scripts/gerar-vapid.mjs`, `scripts/configurar-lembretes-local.mjs`, `tests/integration/send-reminders.test.ts`
- Modify: `supabase/config.toml` (`[edge_runtime] enabled = true`; `[functions.send-reminders] verify_jwt = false`), `vitest.config.ts` (incluir `supabase/functions/**/*.test.ts`), `.gitignore` (`supabase/functions/.env`), `.env.example` (`VITE_VAPID_PUBLIC_KEY=`), `package.json` (scripts `vapid:gerar`, `lembretes:local`)

**Interfaces:**
- Consumes: `due_reminders`, `claim_reminder`, `release_reminder` (Task 1); cron + `set_reminder_config` (Task 2).
- Produces:
  - `_shared/webpush.ts`: `type PushTarget = { id: string; endpoint: string; p256dh: string; auth: string }`; `type PushPayload = { title: string; body: string; url: string; tag: string }`; `type SendResult = { ok: true } | { ok: false; gone: boolean }` (`gone` = HTTP 404/410); `sendPush(target: PushTarget, payload: PushPayload, vapid: { publicKey: string; privateKey: string; subject: string }): Promise<SendResult>` usando `npm:web-push@3` (TTL 3600, urgency `high`). Payload JSON exatamente `{ title, body, url, tag }` com `tag = 'lembrete-' + appointment_id`.
  - `handler.ts`: `handleSendReminders(req: Request, deps: { cronSecret: string; now(): Date; due(now: Date): Promise<Due[]>; claim(id: string, startsAt: string): Promise<boolean>; release(id: string, startsAt: string): Promise<void>; targets(ownerId: string): Promise<PushTarget[]>; send(t: PushTarget, p: PushPayload): Promise<SendResult>; removeTargets(ids: string[]): Promise<void>; touchTargets(ids: string[]): Promise<void> }): Promise<Response>` — responde `401` se o header `x-cron-secret` não bater (comparação em tempo constante); senão, para cada devido: `claim` → se `false` pula; envia para todos os aparelhos do dono; remove os `gone`; atualiza `last_used_at` dos que receberam; se **nenhum** recebeu e houve falha não-`gone`, `release` (tenta de novo no próximo minuto). Responde `200` com `{ due, sent, removed, failed }` (só contagens, nunca nomes). Logs sem dados pessoais (só ids e contagens).
  - `index.ts`: `Deno.serve` ligando `deps` a supabase-js com `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (injetados pelo runtime) e a `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET` dos secrets. Sem lógica além da ligação.
  - `scripts/gerar-vapid.mjs`: gera par VAPID (`web-push` como devDependency), escreve `supabase/functions/.env` com `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:contato@exemplo.com` (placeholder documentado) e `CRON_SECRET` aleatório (32 bytes base64url); não sobrescreve um `.env` existente sem `--forcar`; imprime a linha `VITE_VAPID_PUBLIC_KEY=...` para o `.env.local`.
  - `scripts/configurar-lembretes-local.mjs`: lê `npx supabase status -o json` e `supabase/functions/.env`; chama `set_reminder_config` com a chave secreta (só no processo Node) usando a URL que o container do banco alcança (`http://host.docker.internal:<porta API>/functions/v1/send-reminders`; se não responder, `http://supabase_kong_agenda-em-ordem:8000/functions/v1/send-reminders` — conferir e documentar a que funcionou).

- [ ] **Step 1: Testes do handler que falham** (`handler.test.ts`, Vitest, deps falsas):
  - `secret errado → 401 e nenhuma chamada a due`
  - `dois devidos, dois aparelhos → 4 envios, payload { title, body, url, tag }` com os valores devolvidos por `due`
  - `claim false → não envia` (Review Focus 3)
  - `aparelho 410 → removeTargets([id]) e o outro aparelho recebe`
  - `todos falham com erro temporário → release chamado`; `um recebe e outro falha temporário → release não chamado`
  - `resposta 200 só com contagens e sem nomes de clientes no corpo`
- [ ] **Step 2:** `npm test -- supabase/functions` → FAIL.
- [ ] **Step 3:** Implementar `_shared/webpush.ts`, `handler.ts`, `index.ts`, scripts e config. Habilitar `edge_runtime` exige reiniciar a pilha **deste** repositório (`npx supabase stop && npx supabase start` aqui; nunca `--all`). Conferir na documentação do Supabase CLI como a pilha local carrega `supabase/functions/.env` (automático no `supabase start` ou `supabase functions serve --env-file`) e documentar o comando que funcionou em `docs/supabase-local.md`.
- [ ] **Step 4: Teste de integração** `tests/integration/send-reminders.test.ts` (pilha local, `npm run vapid:gerar` já rodado): POST na função sem header → `401`; com o segredo e nada devido → `200 { due: 0 }`; com um usuário que tem lembrete devido e assinatura com endpoint `https://push.invalid/...` → `200 { due: 1, sent: 0, failed: 1 }` e a reserva foi liberada (`claim_reminder` volta a dar `true`).
- [ ] **Step 5:** `npm test && npm run test:integration && npm run typecheck && npm run lint` → PASS.
- [ ] **Step 6: Commit** — `feat(lembretes): função de envio com Web Push, sem duplicar e limpando aparelhos expirados`

### Task 4: PWA — manifest, ícones, service worker próprio e aviso de nova versão

**Files:**
- Create: `src/sw.ts`, `src/sw/notifications.ts`, `src/sw/notifications.test.ts`, `src/components/layout/UpdatePrompt.tsx`, `src/components/layout/UpdatePrompt.test.tsx`, `pwa-assets.config.ts`, `public/pwa-*.png`, `public/apple-touch-icon-180x180.png`, `public/maskable-icon-512x512.png` (gerados), `tests/e2e/pwa.spec.ts`
- Modify: `vite.config.ts`, `index.html` (apple-mobile-web-app-*, apple-touch-icon), `src/App.tsx` (montar `UpdatePrompt`), `src/routes.tsx` (páginas com `lazy()` por rota), `src/components/layout/SideRail.tsx` (inicial do avatar), `playwright.config.ts` (projeto `pwa` com `vite build --mode test && vite preview --port 5175`), `package.json`

**Interfaces:**
- Produces:
  - `src/sw/notifications.ts` (puro, testável): `parsePushData(data: unknown): { title: string; body: string; url: string; tag: string } | null` — aceita só o formato da Task 3, com `url` relativa começando por `/` (qualquer outra coisa → `/`); `notificationOptions(p): NotificationOptions` com `body`, `tag`, `data: { url }`, `icon: '/pwa-192x192.png'`, `badge`, `renotify: false`; `resolveClickUrl(origin: string, url: string): string`.
  - `src/sw.ts`: `precacheAndRoute(self.__WB_MANIFEST)`, `cleanupOutdatedCaches()`, `navigateFallback` para `index.html` com denylist `/^\/\.well-known\//`; **sem** rotas de runtime caching; `push` → `showNotification`; `notificationclick` → foca uma janela aberta do app e navega para a URL, ou `openWindow`; `message` `SKIP_WAITING`.
  - Manifest: `name: 'Agenda em Ordem'`, `short_name: 'Agenda'`, `lang: 'pt-BR'`, `start_url: '/'`, `scope: '/'`, `display: 'standalone'`, `theme_color: '#0F2D5B'`, `background_color: '#F8FAFC'`, ícones 64/192/512 + maskable 512 (gerados de `public/favicon.svg` com fundo `#0F2D5B` no maskable).
  - `UpdatePrompt`: usa `useRegisterSW` de `virtual:pwa-register/react` (`registerType: 'prompt'`); quando há versão nova mostra toast persistente "Nova versão disponível" com ação "Atualizar" (chama `updateServiceWorker(true)`).
  - Avatar da barra lateral: inicial do `display_name` do perfil (fallback: e-mail) — pendência do Plano 02.

- [ ] **Step 1: Testes que falham:** `notifications.test.ts`: payload válido → opções com `tag` e `data.url`; `url: 'https://evil.com'` → `/`; JSON inválido/campos faltando → `null`. `UpdatePrompt.test.tsx` (mock do módulo virtual): `needRefresh` verdadeiro → texto "Nova versão disponível" e clique em "Atualizar" chama `updateServiceWorker(true)`. Teste do `SideRail`: perfil "Ana Paula" com e-mail `demo@…` → avatar "A".
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar; gerar ícones com `@vite-pwa/assets-generator`; trocar imports de páginas em `routes.tsx` por `lazy()` (pendência do Plano 02: bundle único de 1,04 MB); `devOptions` do plugin desligado (o SW só existe no build).
- [ ] **Step 4: e2e `pwa.spec.ts`** (projeto `pwa`, Chromium, build + preview): `/manifest.webmanifest` tem os campos acima; `navigator.serviceWorker.ready` resolve; após login e abrir `/agenda`, nenhuma chave de Cache Storage contém a URL do Supabase (`caches.keys()` + `cache.keys()`); com `context.setOffline(true)` um reload de `/` ainda mostra a casca do app (barra/logo) e o aviso de sem conexão.
- [ ] **Step 5:** `npm run typecheck && npm run lint && npm test && npm run build && npm run e2e` → PASS; anotar no commit o tamanho do maior chunk depois do `lazy()`.
- [ ] **Step 6: Commit** — `feat(pwa): app instalável com service worker próprio, ícones e aviso de nova versão`

### Task 5: Ativar lembretes neste aparelho — tela Notificações, teste e limpeza ao sair

**Files:**
- Create: `src/features/notifications/push.ts`, `src/features/notifications/usePushDevice.ts`, `src/features/notifications/push.test.ts`, `src/features/notifications/usePushDevice.test.tsx`, `supabase/functions/send-test-notification/{handler.ts,index.ts,handler.test.ts}`
- Modify: `src/features/settings/sections/NotificationsSection.tsx` (+ teste), `src/features/auth/AuthProvider.tsx` (+ teste), `supabase/config.toml` (`[functions.send-test-notification] verify_jwt = true`)

**Interfaces:**
- Consumes: `register_push_subscription` (Task 1); `_shared/webpush.ts` (Task 3); service worker e `parsePushData` (Task 4).
- Produces:
  - `push.ts`: `type DeviceState = 'sem-suporte' | 'iphone-instalar' | 'bloqueado' | 'desativado' | 'ativado'`; `detectDeviceState(env: { hasSW: boolean; hasPush: boolean; hasNotification: boolean; isIOS: boolean; isStandalone: boolean; permission: NotificationPermission; hasSubscription: boolean }): DeviceState` (iOS fora do modo instalado → `iphone-instalar`, mesmo sem `PushManager`); `subscribeThisDevice(): Promise<void>` (pede permissão — só chamado em clique —, `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VITE_VAPID_PUBLIC_KEY })`, RPC `register_push_subscription` com rótulo `deviceLabel()` tipo "iPhone · Safari"); `unsubscribeThisDevice(): Promise<void>` (apaga a linha do endpoint e chama `subscription.unsubscribe()`); erros pelo `toAppError` (rede → RN17: nunca mostrar "ativado" sem a RPC confirmar).
  - `usePushDevice()`: `{ state, busy, error, activate(), deactivate(), sendTest() }`, com trava síncrona contra duplo clique.
  - `send-test-notification`: autenticado pelo JWT do usuário; envia `{ title: 'Agenda em Ordem', body: 'Notificações ativadas neste aparelho.', url: '/ajustes/notificacoes', tag: 'teste' }` **só** para as assinaturas do próprio usuário (consulta com o cliente do usuário, sob RLS); remove `gone`; responde `{ sent, removed }`. Sem limite de frequência no servidor (só alcança os aparelhos do próprio usuário); o botão fica desabilitado enquanto o envio está em andamento.
  - `NotificationsSection` (T09): cartão "Neste aparelho" com o estado e a ação certa — `ativado`: "Lembretes ativados neste aparelho" + "Desativar neste aparelho" + "Enviar notificação de teste"; `desativado`: "Ativar neste aparelho"; `bloqueado`: explicação de como liberar nas configurações do navegador (sem botão); `sem-suporte`: "Este navegador não recebe notificações."; `iphone-instalar`: o guia de 3 passos do T09 (Compartilhar → Adicionar à Tela de Início → abrir pelo ícone e voltar aqui). "Enviar notificação de teste" só aparece habilitado em `ativado` (em outros estados, desabilitado com "Disponível depois de ativar neste aparelho.", como no T09). A prévia passa a usar exatamente o formato do texto real (Global Constraints). Remover "A ativação neste aparelho chega na próxima atualização."
  - `AuthProvider.signOut`: antes de encerrar a sessão, se este aparelho tem assinatura, apaga a linha do endpoint (melhor esforço, com tempo limite de 3 s) e chama `subscription.unsubscribe()`; falha nisso não impede sair.

- [ ] **Step 1: Testes que falham:**
  - `push.test.ts`: tabela de `detectDeviceState` — iOS Safari não instalado → `iphone-instalar`; iOS instalado sem assinatura e permissão `default` → `desativado`; `denied` → `bloqueado`; sem `serviceWorker` → `sem-suporte`; com assinatura e `granted` → `ativado` (Review Focus 5).
  - `usePushDevice.test.tsx`: `activate` só chama `Notification.requestPermission` dentro do clique; permissão negada → estado `bloqueado` e nenhuma RPC; RPC falha por rede → estado continua `desativado` e mensagem "Sem conexão. Nada foi salvo…" (RN17); dois cliques rápidos → uma assinatura e uma RPC.
  - `NotificationsSection.test.tsx`: cada estado mostra o texto/ação acima; prévia com nome oculto mostra `Atendimento às 14:00 · em 30 min`; sem `Ativar` em `iphone-instalar`.
  - `AuthProvider` test: com assinatura ativa, `signOut` apaga a linha do endpoint antes do `auth.signOut` e chama `unsubscribe` (Review Focus 1); RPC/rede falhando não impede sair.
  - `send-test-notification/handler.test.ts`: sem usuário → `401`; envia só para os alvos do usuário; alvo `410` é removido.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm run typecheck && npm run lint && npm test && npm run test:integration` → PASS.
- [ ] **Step 5: Commit** — `feat(notificacoes): ativar lembretes neste aparelho, notificação de teste e limpeza ao sair`

### Task 6: Guia de instalação (iPhone, Android, computador) e aviso discreto no Safari do iPhone

**Files:**
- Create: `src/features/install/InstallPage.tsx`, `src/features/install/InstallPage.test.tsx`, `src/features/install/useInstallPrompt.ts`, `src/features/install/IosInstallBanner.tsx`, `src/features/install/IosInstallBanner.test.tsx`
- Modify: `src/routes.tsx` (rota pública `/instalar`, acessível com ou sem login), `src/features/settings/SettingsPage.tsx` (link "Instalar o app" em Notificações), `src/features/auth/pages/Login.tsx` (link "Como instalar o app" no rodapé), `src/components/layout/AppShell.tsx` (montar o banner)

**Interfaces:**
- Consumes: `detectDeviceState`/detecção de iOS e modo instalado (Task 5).
- Produces:
  - `useInstallPrompt()`: `{ canPrompt: boolean; prompt(): Promise<'accepted' | 'dismissed'> }` a partir de `beforeinstallprompt` (Chrome/Edge/Android); `canPrompt` falso em Safari/Firefox.
  - `/instalar` (estilo Painel em Blocos): abas/seções **iPhone** (3 passos do T09 + aviso de que é preciso entrar de novo depois de instalar — design §6.3), **Android** (botão "Instalar app" quando `canPrompt`, senão passos do menu ⋮ → "Instalar app"; seção "Baixar o APK" **só** quando `VITE_APK_DOWNLOAD_URL` existe, com instruções de "instalar apps desconhecidos"), **Computador** (Chrome/Edge: ícone de instalar na barra de endereço; Mac Safari 17+: Arquivo → "Adicionar ao Dock"). Abre na seção do aparelho detectado.
  - `IosInstallBanner`: só no Safari do iPhone/iPad fora do modo instalado e logado; texto "Instale o app para receber lembretes" + link "Ver como" (`/instalar`) + fechar; fechado → `localStorage['aeo:ocultar-banner-instalar'] = '1'` (flag de interface, não é dado de cliente) e não volta; nunca cobre a navegação inferior.

- [ ] **Step 1: Testes que falham:** `/instalar` sem login renderiza as três seções e abre em "iPhone" com user-agent de iPhone; sem `VITE_APK_DOWNLOAD_URL` não existe texto "Baixar o APK"; com ela, o link aponta para a URL; com `beforeinstallprompt` simulado o botão "Instalar app" chama `prompt()`; banner aparece só em iOS não instalado e some ao fechar (e continua oculto após remontar).
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** implementar. **Step 4:** `npm run typecheck && npm run lint && npm test` → PASS.
- [ ] **Step 5: Commit** — `feat(instalar): guia de instalação para iPhone, Android e computador`

### Task 7: APK Android (TWA via Bubblewrap) — configuração, assetlinks e guia

**Files:**
- Create: `android/twa-manifest.template.json`, `scripts/gerar-assetlinks.mjs`, `scripts/gerar-assetlinks.test.ts`, `docs/guia-apk-android.md`
- Modify: `vite.config.ts` (no build, se `ANDROID_PACKAGE_ID` e `ANDROID_CERT_SHA256` existirem no ambiente, emitir `/.well-known/assetlinks.json`), `.gitignore` (`android/*.keystore`, `android/*.jks`, `android/app/`, `android/build/`), `.env.example` (comentários `ANDROID_PACKAGE_ID=`, `ANDROID_CERT_SHA256=`, `VITE_APK_DOWNLOAD_URL=` — sem valores)

**Interfaces:**
- Produces:
  - `buildAssetLinks(packageId: string, sha256: string[]): object` e CLI `node scripts/gerar-assetlinks.mjs` — valida `packageId` (`^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$`) e cada impressão digital (`^([0-9A-F]{2}:){31}[0-9A-F]{2}$`); saída no formato `[{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name, sha256_cert_fingerprints } }]`.
  - `android/twa-manifest.template.json`: modelo do Bubblewrap com `host`, `packageId`, `name: 'Agenda em Ordem'`, `launcherName: 'Agenda'`, `themeColor: '#0F2D5B'`, `backgroundColor: '#F8FAFC'`, `enableNotifications: true`, `startUrl: '/'`, ícones do Task 4, placeholders `__DOMINIO__`/`__PACOTE__` (sem valores inventados).
  - `docs/guia-apk-android.md` (pt-BR): pré-requisitos (domínio HTTPS em produção, verificação de desenvolvedor Google para distribuir fora da Play Store no Brasil desde set/2026, JDK e Android SDK que o Bubblewrap baixa), passo a passo `bubblewrap init --manifest https://<dominio>/manifest.webmanifest` → `bubblewrap build`, como gerar e **guardar o keystore fora do repositório com backup** (perder = não atualizar mais), como obter a impressão SHA-256, publicar `assetlinks.json`, testar (abre sem barra de endereço = verificação ok), quando gerar APK novo (só quando muda a "casca"), notificações no APK (delegação do TWA, mesmo Web Push), página de download (`VITE_APK_DOWNLOAD_URL`).

- [ ] **Step 1: Testes que falham** (`gerar-assetlinks.test.ts`): saída exata para `br.com.exemplo.agenda` + uma impressão válida; pacote inválido e impressão em minúsculas/curta → erro com mensagem em pt-BR.
- [ ] **Step 2:** FAIL. **Step 3:** implementar + guia. **Step 4:** `npm test && npm run build` → PASS; com as duas variáveis definidas num build de teste, `dist/.well-known/assetlinks.json` existe e é servido pelo `vite preview` com `Content-Type: application/json`; sem elas, não existe.
- [ ] **Step 5: Commit** — `feat(android): configuração do APK (TWA), assetlinks e guia de geração`

### Task 8: Ponta a ponta, checklist de aparelhos reais e documentação

**Files:**
- Create: `tests/e2e/notificacoes.spec.ts`, `docs/notificacoes.md`, `docs/checklist-aparelhos.md`
- Modify: `docs/guia-de-testes.md`, `README.md`, `tests/e2e/support/*` (se precisar)

**Interfaces:**
- Consumes: tudo das Tasks 1–7.

- [ ] **Step 1: e2e `notificacoes.spec.ts`:**
  - `webkit-iphone`: Ajustes › Notificações mostra o guia de 3 passos e nenhum botão "Ativar neste aparelho"; "Enviar notificação de teste" desabilitado com "Disponível depois de ativar neste aparelho."
  - `chromium-desktop`: trocar a antecedência para "1 hora" e ligar "Ocultar nome" grava no perfil (consulta no banco pelo Node) e a prévia mostra `Atendimento às 14:00 · em 1 hora`.
  - fluxo de lembrete sem navegador real de push: criar pelo Node um usuário com assinatura de endpoint `https://push.invalid/...`, um atendimento que entra na janela em até 1 min e aguardar (até 120 s, por consulta, sem `waitForTimeout` fixo) a reserva aparecer e ser liberada em `appointment_reminders` — prova que cron → pg_net → função → banco está ligado de ponta a ponta. O `global-setup` chama a mesma lógica de `scripts/configurar-lembretes-local.mjs` quando `supabase/functions/.env` existe; sem ele, pular com mensagem clara.
  - `/instalar` sem login abre e não tem rolagem horizontal nos 3 projetos.
- [ ] **Step 2:** `docs/notificacoes.md`: como funciona (diagrama simples cron → função → push), configuração local (`npm run vapid:gerar`, copiar `VITE_VAPID_PUBLIC_KEY` para `.env.local`, `npm run lembretes:local`) e em produção (secrets da função pelo painel/CLI: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`; `set_reminder_config` com a URL de produção; `VITE_VAPID_PUBLIC_KEY` no build), limites (atraso de até ~1 min, entrega depende do sistema), privacidade (só o profissional, opção de ocultar nome).
- [ ] **Step 3:** `docs/checklist-aparelhos.md` (design §8 Etapa 10): para iPhone instalado, Android Chrome (WebAPK), APK, Mac Safari, Windows Chrome/Edge — instalar, entrar, ativar, receber teste, receber lembrete real de um atendimento marcado para daqui a 20 min com antecedência 15, tocar e abrir os detalhes, ocultar nome, sair e confirmar que o aparelho deixou de receber; conferir a fonte Manrope/Inter no iPhone real (pendência do Plano 02).
- [ ] **Step 4:** Atualizar `docs/guia-de-testes.md` e `README.md` (novos scripts e pré-requisitos).
- [ ] **Step 5: Gate completo:** `npm run typecheck && npm run lint && npx prettier --check . && npm test && npm run db:test && npm run test:integration && npm run e2e` → PASS; `npm run e2e` uma segunda vez → PASS.
- [ ] **Step 6: Commit** — `test(e2e): notificações, instalação e documentação dos lembretes`
