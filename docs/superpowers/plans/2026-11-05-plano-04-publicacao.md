# Plano 04 — Publicação no plano gratuito — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o Agenda em Ordem pronto para pessoas reais usarem, rodando só em serviços gratuitos: exclusão de conta, política de privacidade, CAPTCHA opcional, confirmação de e-mail, endurecimento de banco e lembretes, cabeçalhos de segurança, backup próprio, verificação do build e um guia de publicação passo a passo.

**Architecture:** Nada muda na arquitetura dos Planos 01–03. Entram:
- uma migração de endurecimento;
- uma Edge Function `delete-account`, que exige senha digitada nos últimos 5 minutos;
- um componente Turnstile que só aparece quando há chave;
- uma página pública `/privacidade`;
- um plugin de build que gera `dist/_headers` com CSP, também aplicado no `vite preview` para os testes ponta a ponta exercitarem a CSP;
- scripts locais de verificação, publicação (Cloudflare Pages por upload direto, sem CI) e backup (`supabase db dump` para uma pasta fora do repositório, com retenção de 30 dias).

**Tech Stack:** o dos Planos 01–03. Novos:
- `wrangler` (devDependency, só para publicar);
- Cloudflare Turnstile, carregado do domínio da Cloudflare, sem pacote npm.

Conferir as versões estáveis atuais na documentação oficial antes de instalar.

**Spec:** `docs/superpowers/specs/2026-10-29-agenda-em-ordem-design.md` (§6.5, §9, §10, §11) + requisitos `docs/superpowers/specs/2026-10-29-agenda-em-ordem-requisitos.md` (§15 Segurança, §16 Privacidade e LGPD) + contrato do banco `docs/banco-de-dados.md` + pendências salvas na memória dos Planos 01–03 (listadas abaixo em cada task).

**Branch:** criar `feat/plano-04-publicacao` a partir de `master` (Planos 01–03 já estão no `master`).

**Decisão do usuário (2026-11-05):** lançar no **plano gratuito do Supabase**. O Pro fica para quando for possível. Consequências tratadas aqui:
- **Pausa por inatividade:** o projeto é pausado depois de 7 dias com pouca atividade e pode ser reativado em até 90 dias. Este plano cria a RPC `ping` e documenta uma chamada diária externa.
- **Sem backups automáticos:** o plano cria um backup próprio, conforme a recomendação do Supabase de usar `supabase db dump`.

**Decisões deste plano (Claude — corrigir se errado):**
- **D1 — Hospedagem do site:** Cloudflare Pages, plano gratuito. Motivos: permite uso comercial, gera um endereço `*.pages.dev` com HTTPS (sem precisar de domínio), aceita `_headers`, trata o site como SPA quando não há `404.html` e é da mesma empresa do Turnstile. A Vercel Hobby proíbe uso comercial.
- **D2 — E-mail:** o guia documenta duas opções. Os e-mails nativos do Supabase não servem para usuários reais por causa do limite de envio.
  - **A (sem domínio, gratuita):** SMTP do Gmail com senha de app.
  - **B (com domínio próprio):** Resend ou Brevo, no plano gratuito.
- **D3 — Exclusão de conta:** a pessoa digita a senha de novo. O servidor só aceita a exclusão se o token mostrar login por senha (`amr`) nos últimos **300 s**.
- **D4 — Backups:** script local que grava fora do repositório e apaga os arquivos com mais de **30 dias**. A mesma regra entra na política de privacidade.
- **D5 — Busca por nome:** a coluna `unaccent` + `pg_trgm` (pendência do Plano 02) fica no backlog. A busca já filtra por dono, e o volume de um profissional é pequeno.
- **D6 — Testes ponta a ponta:** passam a rodar contra o build de produção (`vite build --mode test` + `vite preview`), com os cabeçalhos de `_headers` aplicados. Isso resolve a pendência de usar o build "no CI", sem criar CI: o repositório não tem remoto.

**Fora deste plano:**
- comprar domínio;
- gerar e assinar o APK de verdade (depende da verificação Google);
- Supabase Pro;
- busca com índice (D5);
- link público de agendamento (ideia pós-MVP);
- itens de polimento do backlog dos Planos 02 e 03.

## Global Constraints

**Herdado dos Planos 02–03:**
- pt-BR, `DD/MM/AAAA`, 24 h, fuso do perfil.
- Paleta e tipografia da marca; botões primários `#2563EB`; ação destrutiva em `#B91C1C`.
- Alvos de toque ≥ 44 px; inputs ≥ 16 px no celular; foco visível.
- Sem funcionalidade falsa.
- Erros pelo contrato, sem `details`/`hint`.

**Variáveis do frontend permitidas** (todas públicas por natureza):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_VAPID_PUBLIC_KEY`
- `VITE_APK_DOWNLOAD_URL`
- novas: `VITE_TURNSTILE_SITE_KEY`, `VITE_PRIVACY_CONTROLLER_NAME`, `VITE_PRIVACY_CONTACT_EMAIL`

Nada além disso.

**Segredos e chaves:**
- Nunca no repositório nem no bundle: `service_role`/`sb_secret_*`, chave privada VAPID, `CRON_SECRET`, segredo do Turnstile, senha do banco (`SUPABASE_DB_URL`), credenciais de SMTP.
- Valores de produção ficam em arquivos `*.local` (ignorados pelo git), nos secrets das Edge Functions ou no painel dos serviços.
- **Não inventar valores:** o que depende de conta do usuário fica documentado em `docs/publicacao.md`.

**Autorização:**
- Nunca confiar em id vindo do navegador. A exclusão de conta usa só o `sub` do token verificado no servidor.

**Edge Functions:**
- Imports com versão exata (`npm:pacote@x.y.z`, `jsr:@escopo/pacote@x.y.z`).
- `verify_jwt = false` em todas, e cada handler valida o próprio acesso (JWT do usuário ou `x-cron-secret`). Motivo: o `verify_jwt` legado é incompatível com as novas chaves JWT assimétricas do Supabase hospedado.

**SQL:**
- Toda função nova: `SECURITY DEFINER`, `set search_path = ''` e `GRANT EXECUTE` explícito, porque o revoke global de privilégios padrão está ativo.
- Funções de backend: só `service_role`.

**Logs:**
- Nenhum dado pessoal: nome de cliente, telefone, observações ou e-mail.
- Eventos logados só com ids e códigos.

**Ambiente local:**
- Supabase local nas portas 4432x (API 44321, DB 44322, Studio 44323, Mailpit 44324).
- Nunca parar nem mexer no projeto `gceu-conecta` do usuário. Comandos `supabase` só a partir deste repositório.
- Chaves sempre lidas de `npx supabase status -o json`.

## Review Focus

1. **Exclusão com sessão antiga ou aparelho de outra pessoa deixado logado.**
   - Sem senha digitada nos últimos 5 min, nada é apagado.
   - Excluir a conta A nunca toca os dados de B.
   - Coberto pelos testes de handler e de integração na Task 4.
2. **Exclusão feita no servidor com a resposta perdida** (rede caiu).
   - A tela não pode ficar presa numa sessão morta.
   - Ao repetir, se o Auth disser que o usuário não existe, a tela trata como excluída: sai e mostra a mensagem final.
   - Coberto pelo teste `deleteAccount` na Task 4.
3. **CAPTCHA ligado, mas o script do Turnstile bloqueado** (bloqueador de anúncios, sem rede).
   - Mensagem clara com "Tentar de novo", nunca um botão desabilitado sem explicação.
   - Coberto pelo teste do hook na Task 3.
4. **CSP de produção bloqueando o próprio app** (Supabase, fontes, service worker, Turnstile).
   - Os testes ponta a ponta rodam com os cabeçalhos gerados, e qualquer violação de CSP no console falha o teste.
   - Coberto pela Task 7.
5. **Chave VAPID trocada.**
   - Aparelhos que abrem o app se reinscrevem sozinhos.
   - Aparelhos que nunca abrem são apagados depois de 3 falhas permanentes, e o envio não fica tentando para sempre.
   - Coberto pelos testes da Task 1 (banco) e da Task 2 (handler e cliente).

---

### Task 1: Banco — endurecimento para produção

Pendências: Plano 03 (limpeza de `cron.job_run_details`, índice parcial, revogar `net`, falhas permanentes de push, timeout do pg_net) e Plano 01 (índice `appointment_history.owner_id`).

**Files:**
- Create: `supabase/migrations/20261105000100_producao.sql`, `supabase/tests/database/11_producao.test.sql`
- Modify: `supabase/tests/database/08_invariants.test.sql` (só se as invariantes abaixo já não estiverem lá — não duplicar), `src/types/database.ts` (`npm run db:types`), `docs/banco-de-dados.md`

**Interfaces:**
- Produces:
  - Colunas `push_subscriptions.failure_count int not null default 0`.
  - `public.record_push_results(p_ok uuid[], p_failed uuid[]) returns integer`, só `service_role`:
    - ids em `p_ok`: `failure_count = 0`, `last_used_at = now()`;
    - ids em `p_failed`: `failure_count + 1`;
    - em seguida apaga as assinaturas com `failure_count >= 3` entre os ids de `p_failed`;
    - retorna quantas apagou.
  - `public.ping() returns text`: `'ok'`, `stable`, sem ler tabela; `GRANT EXECUTE` para `anon, authenticated`. Mantém o projeto gratuito ativo (Task 8).
  - `app_private.invoke_send_reminders()` recriada com `timeout_milliseconds := 30000` (antes 10000).
  - Job `limpar-historico-cron`, `'17 3 * * *'`: `delete from cron.job_run_details where end_time < now() - interval '7 days'`.
  - Índices:
    - `appointments_agendado_starts_at_idx on public.appointments (starts_at) where status = 'agendado'`
    - `appointment_history_owner_id_idx on public.appointment_history (owner_id)`
  - Revogar de `public, anon, authenticated`: `usage` no schema `net`, todos os privilégios nas tabelas de `net` e `execute` nas funções de `net`.

- [ ] **Step 1: Escrever `11_producao.test.sql` (falha)**

  O teste cobre:
  - `has_schema_privilege('anon','net','usage')` e o mesmo para `authenticated` são falsos;
  - `has_table_privilege('authenticated','net.http_request_queue','select')` é falso;
  - job `limpar-historico-cron` existe com o horário `'17 3 * * *'`;
  - os dois índices existem;
  - `record_push_results`:
    - uma assinatura com 2 falhas, chamada com `p_failed=[id]`, retorna `1` e a linha some;
    - com `p_ok=[id]`, zera `failure_count`;
    - a chamada como `authenticated` dá `42501`;
  - `ping()` como `anon` retorna `'ok'`;
  - `invoke_send_reminders` tem `30000` no corpo (`pg_get_functiondef` contém `30000`).

  Em `08_invariants` (se ainda não houver), três invariantes:
  - toda tabela de `public` tem RLS ligada;
  - toda função `prosecdef` em `public`/`app_private` tem `proconfig` com `search_path=""`;
  - `anon` não tem privilégio de tabela em `public`.

- [ ] **Step 2: Rodar e ver falhar**

  Run: `npm run db:test`
  Expected: FAIL em `11_producao`.

- [ ] **Step 3: Escrever a migração**

  - Idempotente onde der: `if not exists`, `cron.schedule` com nome substitui o job existente.
  - Revogação de `net` com `revoke ... on all tables/functions in schema net`.

- [ ] **Step 4: Rodar a suíte**

  Run: `npm run db:test`
  Expected: PASS em todos, incluindo 09/10.

- [ ] **Step 5: Atualizar a documentação**

  - Regerar os tipos.
  - Em `docs/banco-de-dados.md`: novas funções, job, índices e revogação.
  - Avisar no doc que uma atualização da extensão `pg_net` no Supabase hospedado pode devolver os grants. O teste de invariantes e o checklist de publicação (Task 9) conferem isso.

- [ ] **Step 6: Commit**

  ```bash
  git add supabase/migrations/20261105000100_producao.sql supabase/tests/database src/types/database.ts docs/banco-de-dados.md
  git commit -m "feat(banco): endurecimento para produção (net, cron, índices, falhas de push)"
  ```

### Task 2: Lembretes robustos — falhas permanentes, troca de chave VAPID, envios em paralelo, imports fixos

Pendências do Plano 03: falhas permanentes e roteiro de VAPID; `deno check` e imports fixos; `verify_jwt` de `send-test-notification`; envios sequenciais.

**Files:**
- Create: `supabase/functions/_shared/serviceKey.ts` (extrai `serviceKey()` de `send-reminders/index.ts` para reuso)
- Modify:
  - `supabase/functions/send-reminders/{handler.ts,index.ts,handler.test.ts}`
  - `supabase/functions/send-test-notification/index.ts`
  - `supabase/functions/_shared/webpush.ts`
  - `supabase/config.toml` (`[functions.send-test-notification] verify_jwt = false`, com comentário dizendo que o handler valida o usuário)
  - `src/features/notifications/{push.ts,push.test.ts,usePushDevice.ts,usePushDevice.test.tsx}`
  - `src/test/fakePush.ts`
  - `docs/notificacoes.md`

**Interfaces:**
- Consumes: `record_push_results` (Task 1).
- Produces:
  - Em `SendRemindersDeps`, `touchTargets(ids)` é substituído por `recordResults(okIds: string[], failedIds: string[]): Promise<number>`.
  - `SendResult` passa a distinguir `'permanente'` para os status 400, 401 e 403.
  - Constante `REMINDER_CONCURRENCY = 5`: no máximo 5 lembretes processados ao mesmo tempo.
  - Regra de liberação da reserva: liberar quando nenhum aparelho recebeu e houve ao menos uma falha temporária ou permanente. Aparelhos "sumidos" (404/410) não contam.
  - No cliente: `ensureCurrentKey(registration: ServiceWorkerRegistration, vapidPublicKey: string, register: (sub: PushSubscription) => Promise<void>): Promise<'ok' | 'renovada'>` em `push.ts`.
    - Se a `applicationServerKey` da inscrição atual for diferente da chave atual, cancela a inscrição, inscreve de novo com a chave atual e registra pela RPC `register_push_subscription`.
    - `usePushDevice` chama quando o estado do aparelho é "ativo" ao montar.

- [ ] **Step 1: Testes do handler (falham)**

  Três testes:
  - `permanente_conta_falha_e_libera`: um aparelho responde 403. Esperado: `recordResults([], [id])` e `release` chamado.
  - `sucesso_zera_falhas`: `recordResults([id], [])`.
  - `no_maximo_5_em_paralelo`: 12 lembretes com `send` instrumentado para medir o pico de chamadas simultâneas. Esperado: pico `=== 5` e as 12 processadas.

- [ ] **Step 2: Teste do cliente (falha)**

  `ensureCurrentKey`:
  - inscrição com outra chave → `'renovada'`, `unsubscribe` chamado e `register` chamado com a nova inscrição;
  - mesma chave → `'ok'`, sem efeitos.

  Estender `fakePush` com `options.applicationServerKey`.

- [ ] **Step 3: Implementar e rodar**

  Run: `npx vitest run supabase/functions src/features/notifications`
  Expected: PASS.

- [ ] **Step 4: Fixar versões dos imports**

  - `npm:@supabase/supabase-js@<mesma versão do package.json>`.
  - `jsr:@supabase/functions-js@<versão estável atual>/edge-runtime.d.ts`.
  - `web-push` já está fixo em 3.6.7.

- [ ] **Step 5: Rodar o `deno check`**

  Run: `deno check supabase/functions/send-reminders/index.ts supabase/functions/send-test-notification/index.ts`
  Expected: sem erros.

  Se `deno` não estiver instalado, **parar e reportar BLOCKED** pedindo ao usuário `winget install --id DenoLand.Deno`. Não usar `npx deno` (já foi bloqueado por permissão).

- [ ] **Step 6: Integração e ponta a ponta das notificações**

  Run: `npx supabase stop && npx supabase start`, depois `npm run lembretes:local && npm run test:integration && npx playwright test notificacoes`
  Expected: PASS. O edge runtime não recarrega sozinho no Windows, por isso a reinicialização.

- [ ] **Step 7: Documentação**

  Em `docs/notificacoes.md`, a seção "Trocar as chaves VAPID", com:
  - quando trocar;
  - os comandos (`npm run vapid:gerar` local; `supabase secrets set` em produção + nova `VITE_VAPID_PUBLIC_KEY` + publicar o site);
  - o que acontece: quem abre o app é reinscrito; os demais são apagados depois de 3 tentativas e precisam ativar de novo.

- [ ] **Step 8: Commit**

  ```bash
  git commit -am "feat(lembretes): falhas permanentes, troca de chave VAPID, envio em paralelo e imports fixos"
  ```

  Incluir os arquivos novos com `git add` antes.

### Task 3: Auth de produção — CAPTCHA opcional, confirmação de e-mail, senha mínima

Pendências: Plano 01 (configurar auth de produção). Design §6.5: CAPTCHA opcional.

**Files:**
- Create:
  - `src/features/auth/captcha/turnstile.ts`: carrega o script uma vez; a promessa fica em cache e é limpa se der erro.
  - `src/features/auth/captcha/useCaptcha.tsx`
  - `src/features/auth/captcha/useCaptcha.test.tsx`
- Modify:
  - `src/lib/env.ts`, `src/lib/env.test.ts`, `.env.example`
  - `src/features/auth/authErrors.ts` (+ teste)
  - `src/features/auth/pages/{Login,Signup,ForgotPassword}.tsx` (+ testes)
  - `supabase/config.toml`
  - `tests/e2e/auth.spec.ts`

**Interfaces:**
- Produces:
  - `Env.turnstileSiteKey: string | null`, de `VITE_TURNSTILE_SITE_KEY`, opcional.
  - `useCaptcha(action: 'login' | 'cadastro' | 'recuperar' | 'excluir-conta'): { required: boolean; token: string | null; error: string | null; reset(): void; element: ReactNode }`:
    - Sem chave: `required=false`, `token=null`, `element=null`.
    - Com chave: renderiza o widget (`render=explicit`, `language: 'pt-br'`, `action`), com estes callbacks:
      - `callback` → token;
      - `expired-callback` → `token=null`;
      - `error-callback` ou falha ao carregar o script → `error`.
  - Texto do erro, fixo: `Não foi possível carregar a verificação de segurança. Confira sua conexão e tente de novo.`
  - Botão `Tentar de novo`, que recarrega o script.
  - `reset()` reinicia o widget. Chamar depois de **toda** tentativa de envio, porque o token só vale uma vez.
  - URL do script: `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`.
  - Novos códigos em `authErrorMessage`:
    - `captcha_failed` → `Não foi possível confirmar que você não é um robô. Tente de novo.`
    - `email_not_confirmed` → `Confirme seu e-mail pelo link que enviamos antes de entrar.`
  - Login, Cadastro e Recuperar senha passam `options: { captchaToken }`. Quando `required`, o envio fica bloqueado até haver token, com a dica `Conclua a verificação de segurança acima.`

- [ ] **Step 1: Testes (falham)**

  - `env`: chave opcional lida e aparada.
  - `useCaptcha` com `window.turnstile` falso:
    - sem chave não renderiza;
    - com chave, `callback('tok')` → `token==='tok'`;
    - falha ao carregar → mensagem de erro + botão `Tentar de novo`, que tenta de novo e funciona.
  - `Login`: com chave, envia `captchaToken` e chama `reset` depois de erro.
  - `authErrors`: os dois códigos novos.

- [ ] **Step 2: Implementar e rodar**

  Run: `npx vitest run src/features/auth src/lib/env.test.ts`
  Expected: PASS.

- [ ] **Step 3: Espelhar a produção no `config.toml` local**

  - `minimum_password_length = 8`, igual ao frontend.
  - `[auth.email] enable_confirmations = true`.
  - Bloco `[auth.captcha]` com `enabled = false` e `provider = "turnstile"`.
  - O segredo vai via `env(SUPABASE_AUTH_CAPTCHA_SECRET)`, comentado.

- [ ] **Step 4: Ajustar o teste ponta a ponta de cadastro**

  - O cadastro agora mostra "Confira seu e-mail".
  - O teste abre o link no Mailpit (`E2E_MAILPIT_URL`), confirma e chega ao primeiro acesso.
  - Um teste novo: entrar antes de confirmar mostra `Confirme seu e-mail pelo link que enviamos antes de entrar.`
  - Usuários criados por fixture já usam `email_confirm: true`.

  Run: `npx supabase stop && npx supabase start && npx playwright test auth`
  Expected: PASS.

- [ ] **Step 5: Verificação manual única com as chaves de teste da Cloudflare**

  Não deixar habilitado no repositório.
  - Confirmar na documentação da Cloudflare as chaves de teste "sempre passa" atuais.
  - Habilitar `[auth.captcha]` localmente com o segredo de teste e subir o app com a site key de teste.
  - Entrar com sucesso.
  - Depois, sem token: o Supabase recusa com `captcha_failed`.
  - Reverter a configuração.
  - Registrar o resultado no relatório da task.

- [ ] **Step 6: Commit**

  ```bash
  git commit -am "feat(auth): CAPTCHA Turnstile opcional, confirmação de e-mail e senha mínima 8"
  ```

  Incluir os arquivos novos com `git add` antes.

### Task 4: Excluir minha conta

Requisitos §16 ("Fluxo seguro de exclusão de conta e dados"); design §6.5.

**Files:**
- Create:
  - `supabase/functions/delete-account/{handler.ts,handler.test.ts,index.ts}`
  - `tests/integration/delete-account.test.ts`
  - `src/features/account/deleteAccount.ts` (+ `.test.ts`)
  - `src/features/account/DeleteAccountDialog.tsx` (+ `.test.tsx`)
  - `tests/e2e/excluir-conta.spec.ts`
- Modify:
  - `supabase/config.toml` (`[functions.delete-account] verify_jwt = false`)
  - `src/features/settings/sections/AccountSection.tsx`
  - `src/features/auth/pages/Login.tsx`: mostra `Sua conta e todos os seus dados foram excluídos.` quando a URL tem `?conta=excluida`.

**Interfaces:**
- Consumes:
  - `serviceKey()` (Task 2);
  - `useCaptcha('excluir-conta')` (Task 3);
  - `useAuth().signOut()`, que já limpa o aparelho (Plano 03).
- Produces:
  - Handler:
    - `handleDeleteAccount(req: Request, deps: DeleteAccountDeps): Promise<Response>`
    - `DeleteAccountDeps = { verify(token: string): Promise<{ userId: string; passwordAuthAt: number | null } | null>; deleteUser(userId: string): Promise<void>; now(): Date }`
    - `passwordAuthAt` é o `timestamp` (segundos) da entrada `method: 'password'` em `amr`.
  - Respostas, com CORS igual a `send-test-notification`:
    - `204` sucesso;
    - `401 {"error":"nao_autenticado"}`: sem token ou token inválido/usuário inexistente;
    - `403 {"error":"reautenticacao_necessaria"}`: `passwordAuthAt` nulo ou anterior a `now − 300 s`;
    - `405`;
    - `500 {"error":"falha_ao_excluir"}`.
  - `index.ts`:
    - `verify` confirma o token no Auth com `auth.getUser(token)` e lê `amr` das claims verificadas (`auth.getClaims(token)`);
    - `deleteUser` usa `auth.admin.deleteUser(userId)` com a chave de serviço;
    - a exclusão em cascata a partir de `profiles` apaga horários, favoritos, atendimentos, histórico, assinaturas e lembretes.
  - Cliente:
    - `deleteAccount(input: { email: string; password: string; captchaToken: string | null }): Promise<void>`, que lança `DeleteAccountError` com `kind: 'senha' | 'rede' | 'falha'`.
    - Passo 1: `signInWithPassword`; `invalid_credentials` → `'senha'`.
    - Passo 2: `functions.invoke('delete-account', { method: 'POST' })`.
    - Se o passo 2 falhar por rede: chama `auth.getUser()`. Se o Auth disser que o usuário não existe (`user_not_found` ou 403 de usuário inexistente), considera excluído e retorna normalmente (Review Focus 2).

- [ ] **Step 1: Testes do handler (falham)**

  Cinco casos:
  - token ausente → 401;
  - `verify` → `null` → 401;
  - `passwordAuthAt = now − 301` → 403 e `deleteUser` não chamado;
  - `passwordAuthAt = now − 10` → 204 e `deleteUser(userId)` com o id do **token**. Um `user_id` no corpo é ignorado;
  - `deleteUser` lança → 500 sem detalhes.

- [ ] **Step 2: Implementar o handler e o `index.ts`; rodar**

  Run: `npx vitest run supabase/functions/delete-account`
  Expected: PASS.

- [ ] **Step 3: Teste de integração (stack local reiniciada)**

  - Usuários A e B, cada um com perfil, atendimento e assinatura.
  - A entra com senha e chama → 204.
  - A não existe mais e as tabelas não têm linhas de A. Todas as linhas de B continuam.
  - Para B: entrar com senha, guardar o `timestamp` do `amr` de senha, chamar `refreshSession()` e conferir que o `timestamp` do novo token é **o mesmo**. É isso que garante que renovar o token não conta como "senha recente". O tempo de 300 s em si é coberto pelo teste do handler.

  **Se o `timestamp` mudar no *refresh*, parar e reportar.** A regra D3 precisaria de outro desenho.

  Run: `npx supabase stop && npx supabase start && npm run test:integration`
  Expected: PASS.

- [ ] **Step 4: Testes do cliente (falham, depois passam)**

  `deleteAccount`:
  - senha errada → `'senha'` e a função não é chamada;
  - sucesso;
  - rede falha + `getUser` diz inexistente → resolve;
  - rede falha + usuário existe → `'rede'`.

- [ ] **Step 5: Diálogo**

  - Em `AccountSection`, um novo bloco `Excluir conta`, com o texto: `Apaga sua conta e todos os seus dados: clientes, atendimentos, histórico e aparelhos com lembretes. Não dá para desfazer.`
  - Dentro do bloco, o link `Baixar meus dados (CSV)` antes, para exportar primeiro.
  - Botão vermelho `Excluir minha conta`.
  - O diálogo pede a senha atual e mostra o CAPTCHA quando houver chave.
  - Botão de confirmação `Excluir para sempre`, mais `Cancelar`.
  - Erros:
    - `'senha'` → `Senha incorreta.`
    - `'rede'` → `Sem conexão. Confira a internet e tente de novo.`
    - `'falha'` → `Não foi possível excluir a conta agora. Tente de novo em alguns minutos.`
  - No sucesso: `signOut()` e navegar para `/entrar?conta=excluida`.

  Testes do diálogo: os estados acima, mais o botão desabilitado durante o envio.

- [ ] **Step 6: Teste ponta a ponta**

  `excluir-conta.spec.ts`, em todos os projetos de dispositivo:
  - criar usuário com atendimento, excluir pela tela;
  - ver a mensagem em `/entrar`;
  - entrar com as mesmas credenciais mostra `E-mail ou senha incorretos.`

  Run: `npx playwright test excluir-conta`
  Expected: PASS.

- [ ] **Step 7: Commit**

  ```bash
  git commit -am "feat(conta): exclusão da conta e de todos os dados com senha recente"
  ```

  Incluir os arquivos novos com `git add` antes.

### Task 5: Política de privacidade e orientações de retenção

Requisitos §16: política de privacidade, mecanismo de exportação (já existe), orientações de retenção.

**Files:**
- Create:
  - `src/features/legal/PrivacyPage.tsx` (+ `.test.tsx`)
  - `src/features/legal/privacyInfo.ts`
  - `docs/privacidade-e-retencao.md`: orientações para quem opera o serviço.
- Modify:
  - `src/routes.tsx`: rota pública `/privacidade`, fora do `RequireAuth`, lazy.
  - `src/lib/env.ts`, `.env.example`
  - `Signup.tsx`, `Login.tsx`
  - `AccountSection.tsx`
  - `src/features/install/InstallPage.tsx`: link no rodapé.

**Interfaces:**
- Produces:
  - `Env.privacyControllerName: string | null` e `Env.privacyContactEmail: string | null`, ambos opcionais. O e-mail só é aceito se for válido.
  - `PRIVACY_UPDATED_AT = '2026-11-05'`, constante em `privacyInfo.ts`, exibida como `05/11/2026`.

- [ ] **Step 1: Testes (falham)**

  - A página renderiza as seções abaixo (títulos exatos).
  - Com as variáveis definidas, mostra o nome e o e-mail como link `mailto:`.
  - Sem elas, mostra `Contato do responsável ainda não informado.` A Task 7 impede publicar assim.
  - `Signup` mostra `Ao criar sua conta, você concorda com a Política de Privacidade.`, com link para `/privacidade`.

- [ ] **Step 2: Escrever a página**

  Títulos, nesta ordem:
  1. `Quem somos`
  2. `Quais dados guardamos`
  3. `Para que usamos`
  4. `Com quem compartilhamos`
  5. `Por quanto tempo guardamos`
  6. `Seus direitos`
  7. `Segurança`
  8. `Mudanças nesta política`

  Conteúdo, conforme o que o app de fato faz:
  - **Dados guardados:**
    - conta: nome, e-mail, preferências da agenda;
    - dados dos clientes digitados pelo profissional: nome, telefone opcional, observações opcionais, atendimentos e histórico;
    - aparelhos com lembretes: endereço técnico de envio e nome do aparelho.
  - **Papéis:** o profissional é o controlador dos dados dos seus clientes; o serviço atua como operador.
  - **Base legal:** execução do contrato.
  - **Compartilhamento (operadores):**
    - Supabase: banco e login;
    - Cloudflare: hospedagem do site e verificação anti-robô;
    - provedor de e-mail: só e-mails de conta;
    - serviços de notificação da Apple/Google/Mozilla: recebem o lembrete **criptografado**.
  - **Nenhum** uso de analytics ou publicidade.
  - **Retenção:**
    - enquanto a conta existir;
    - exclusão imediata e definitiva pelo app;
    - cópias de segurança apagadas em até 30 dias (D4);
    - registros técnicos sem dados pessoais.
  - **Direitos:**
    - acessar e exportar (CSV em Ajustes);
    - corrigir no próprio app;
    - excluir (Ajustes › Conta);
    - contato pelo e-mail informado.

  Linguagem simples, pt-BR, sem juridiquês. No relatório final, recomendar revisão por advogado.

- [ ] **Step 3: Escrever `docs/privacidade-e-retencao.md`**

  - Como atender um pedido de titular (cliente final → orientar a falar com o profissional; profissional → app ou e-mail).
  - Prazo de 30 dias dos backups.
  - Nunca copiar dumps para nuvem pessoal sem criptografia.
  - O que fazer em caso de incidente: revogar chaves, trocar segredos, avisar os afetados e a ANPD quando aplicável.

- [ ] **Step 4: Rodar**

  Run: `npx vitest run src/features/legal src/features/auth src/lib/env.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git commit -am "feat(privacidade): política de privacidade pública e orientações de retenção"
  ```

  Incluir os arquivos novos com `git add` antes.

### Task 6: Passe de acessibilidade

Pendência do Plano 02.

**Files:**
- Modify:
  - `src/components/layout/AppShell.tsx` (+ teste)
  - `src/features/calendar/views/WeekView.tsx`, `MonthView.tsx` (+ testes, se a classe for testável)
  - o input compartilhado que cai para 14 px entre 768 e 1023 px (`src/components/ui/input.tsx` ou `FIELD` em `src/features/settings/sections/shared.tsx`; encontrar a origem do `md:text-sm`)
  - `tests/e2e/responsivo.spec.ts`

**Interfaces:**
- Produces:
  - Link `Pular para o conteúdo` como primeiro elemento focável, visível só com foco, apontando para `#conteudo`.
  - O `<main>` do AppShell recebe `id="conteudo"` e `tabIndex={-1}`.

- [ ] **Step 1: Testes (falham)**

  Unitário:
  - o primeiro `Tab` foca `Pular para o conteúdo`;
  - ativar o link move o foco para `main#conteudo`.

  Ponta a ponta, em `responsivo.spec.ts`, nos viewports 320×640 e 360×740:
  - toda célula de dia da faixa semanal e do mês tem altura e largura ≥ 44;
  - em 800×1000, os inputs de Ajustes têm `font-size` calculado ≥ 16 px.

  Usar `tests/e2e/support/layout.ts`.

- [ ] **Step 2: Implementar e rodar**

  - Se 7 colunas de 44 px não couberem em 320 px com o espaçamento atual, reduzir o espaçamento lateral ou entre células, nunca o alvo.
  - Aceitar texto abreviado do dia (`S`, `T`, `Q`…) com `aria-label` completo.

  Run: `npx vitest run src/components/layout && npx playwright test responsivo`
  Expected: PASS.

- [ ] **Step 3: Commit**

  ```bash
  git commit -am "fix(a11y): atalho para o conteúdo, alvos de 44 px em telas estreitas e inputs de 16 px"
  ```

### Task 7: Build de produção — cabeçalhos de segurança, verificação, testes no build e publicação do site

**Files:**
- Create:
  - `scripts/gerar-headers.mjs` + `scripts/gerar-headers.d.mts` + `scripts/gerar-headers.test.ts`
  - `scripts/verificar-producao.mjs` + `.d.mts` + `.test.ts`
  - `scripts/publicar-site.mjs`
- Modify:
  - `vite.config.ts`: plugin que emite `_headers` no build e aplica os cabeçalhos no `preview`.
  - `playwright.config.ts`
  - `tests/e2e/support/fixtures.ts`: falha em violação de CSP.
  - `package.json`: scripts `verificar:producao`, `publicar:site`; `wrangler` em devDependencies com versão exata.
  - `docs/guia-de-testes.md`

**Interfaces:**
- Produces:
  - `buildHeaders(opts: { supabaseUrl: string; turnstile: boolean }): string` gera o conteúdo do `_headers` (formato Cloudflare Pages).
  - Bloco `/*`:
    - `Content-Security-Policy: default-src 'self'; script-src 'self'[ https://challenges.cloudflare.com]; frame-src[ https://challenges.cloudflare.com| 'none']; connect-src 'self' <origem https do Supabase> <mesma origem com wss://>; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
    - `X-Content-Type-Options: nosniff`
    - `Referrer-Policy: strict-origin-when-cross-origin`
    - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
    - `X-Frame-Options: DENY`
  - Outros blocos:
    - `/sw.js` e `/index.html`: `Cache-Control: no-cache`;
    - `/assets/*`: `Cache-Control: public, max-age=31536000, immutable`.
  - `parseHeaders(text: string): Array<{ pattern: string; headers: Record<string, string> }>`. O plugin usa no `preview`, e casa `/*`, caminhos exatos e prefixos com `*`.
  - `checkProductionEnv(env: Record<string, string | undefined>): string[]` (lista de problemas; vazia = ok). Exige:
    - `VITE_SUPABASE_URL` com `https:`;
    - `VITE_SUPABASE_PUBLISHABLE_KEY` presente e **não** `sb_secret_…` nem JWT com `"role":"service_role"`;
    - `VITE_VAPID_PUBLIC_KEY`, `VITE_PRIVACY_CONTROLLER_NAME` e `VITE_PRIVACY_CONTACT_EMAIL` presentes;
    - nenhuma variável `VITE_*` fora da lista permitida.
  - `scanBundle(dir: string): string[]`: arquivos de `dist/` que contêm `sb_secret_`, `service_role`, `-----BEGIN` ou `PRIVATE KEY`.
  - `npm run verificar:producao`:
    - carrega `.env.production.local` com o `loadEnv('production')` do Vite;
    - roda `checkProductionEnv`, depois `vite build`, depois `scanBundle('dist')`;
    - sai com código 1 e lista os problemas.
  - `npm run publicar:site`:
    - roda `verificar:producao`;
    - depois `npx wrangler pages deploy dist --project-name=$CF_PAGES_PROJECT`;
    - `CF_PAGES_PROJECT` também vem do `.env.production.local`; não é `VITE_` e não vai para o bundle.

- [ ] **Step 1: Testes dos scripts (falham)**

  `buildHeaders`:
  - com `https://abc.supabase.co` e `turnstile=false`: o CSP contém `connect-src 'self' https://abc.supabase.co wss://abc.supabase.co` e `frame-src 'none'`, e não contém `challenges.cloudflare.com`;
  - com `turnstile=true`: contém `challenges.cloudflare.com` em `script-src` e `frame-src`.

  `parseHeaders(buildHeaders(...))` devolve os 3 blocos.

  `checkProductionEnv`:
  - chave `sb_secret_x` → problema;
  - URL `http://` → problema;
  - `VITE_FOO` → problema;
  - completo → `[]`.

  `scanBundle` numa pasta temporária com um arquivo contendo `sb_secret_` → lista o arquivo.

- [ ] **Step 2: Implementar os scripts e o plugin; rodar**

  Run: `npx vitest run scripts`
  Expected: PASS.

- [ ] **Step 3: Testes ponta a ponta no build**

  - Um único `webServer`: `npx vite build --mode test && npx vite preview --port 5174 --strictPort`.
  - Os projetos de dispositivo usam `serviceWorkers: 'block'`, para o `page.route` continuar interceptando.
  - O projeto `pwa` usa `serviceWorkers: 'allow'` na mesma URL.
  - Remover o segundo servidor (5175) e revisar os comentários de *timeout* e *workers*: o motivo era o servidor de desenvolvimento.
  - A fixture registra `page.on('console')` e falha o teste em mensagens com `Content Security Policy` ou `Refused to`.

  Run: `npm run e2e`
  Expected: todos passam, sem violação de CSP. Rodar 2× para checar estabilidade.

- [ ] **Step 4: Verificar com um ambiente de produção fictício**

  Com um `.env.production.local` temporário: valores fictícios de formato válido (`VITE_SUPABASE_URL=https://exemplo.supabase.co`, etc.; o build não contacta o servidor), mais um caso propositalmente errado (`VITE_SUPABASE_PUBLISHABLE_KEY=sb_secret_teste`).

  Run: `npm run verificar:producao`
  Expected: código 1 listando a chave secreta.

  Corrigir para valores válidos de teste e rodar de novo → código 0. Apagar o arquivo temporário.

- [ ] **Step 5: Atualizar a documentação**

  `docs/guia-de-testes.md`: os testes ponta a ponta rodam no build; como ver violações de CSP.

- [ ] **Step 6: Commit**

  ```bash
  git commit -am "feat(publicacao): cabeçalhos de segurança, verificação do build e testes no build de produção"
  ```

  Incluir os arquivos novos com `git add` antes.

### Task 8: Backup próprio e projeto gratuito sempre ativo

**Files:**
- Create:
  - `scripts/backup-producao.mjs` + `.d.mts` + `.test.ts`
  - `docs/backup-e-restauracao.md`
- Modify:
  - `package.json`: script `backup:producao`.
  - `.gitignore`: `.env.backup.local`.

**Interfaces:**
- Consumes: `public.ping()` (Task 1).
- Produces:
  - `backupDir(env, home, repoRoot): string`:
    - usa `AGENDA_BACKUP_DIR` ou `<home>/Backups/agenda-em-ordem`;
    - **lança** se o caminho resolvido estiver dentro do repositório.
  - `backupFileNames(now: Date): { roles: string; schema: string; data: string }`, no formato `AAAA-MM-DD_HHmm-<tipo>.sql`.
  - `expiredBackups(files: { name: string; mtimeMs: number }[], now: Date, days = 30): string[]`.
  - `npm run backup:producao`:
    - lê `SUPABASE_DB_URL` do ambiente ou de `.env.backup.local`, **nunca** de arquivo versionado;
    - roda `npx supabase db dump --db-url <url>` três vezes: `--role-only`, padrão (schema) e `--data-only`;
    - o dump de dados inclui `auth`, porque `profiles` referencia `auth.users`. Conferir as opções atuais na ajuda da CLI;
    - grava os arquivos e apaga os que tiverem mais de 30 dias;
    - imprime só nomes de arquivos, nunca a URL com senha.

- [ ] **Step 1: Testes (falham)**

  - `backupDir` lança para `<repo>/backups` e para `<repo>`; aceita `<home>/Backups/agenda-em-ordem`.
  - `backupFileNames(new Date('2026-11-05T13:07:00Z'))` usa o horário local da máquina; o teste fixa `TZ`.
  - `expiredBackups` com arquivos de 29 e 31 dias → só o de 31.

- [ ] **Step 2: Implementar e rodar**

  Run: `npx vitest run scripts/backup-producao.test.ts`
  Expected: PASS.

- [ ] **Step 3: Backup e restauração de verdade contra o banco local**

  1. `SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:44322/postgres AGENDA_BACKUP_DIR=<scratchpad>/bkp npm run backup:producao`, com um usuário e um atendimento criados antes.
     Expected: 3 arquivos não vazios. O de dados contém `appointments`.
  2. Restaurar num banco descartável dentro do contêiner local:
     - `docker exec <contêiner db deste projeto> createdb -U postgres restauro_teste`;
     - aplicar os arquivos com `psql`;
     - contar as linhas de `public.appointments`: igual ao original.
     - Usar só o contêiner `supabase_db_agenda-em-ordem`, nunca o do `gceu-conecta`.
  3. Apagar o banco descartável.
  4. Registrar os comandos que funcionaram em `docs/backup-e-restauracao.md`.

- [ ] **Step 4: Escrever `docs/backup-e-restauracao.md`**

  - Rotina sugerida: semanal, mais antes de cada `db push`.
  - Onde fica a URL do banco no painel.
  - Restauração num projeto novo.
  - Retenção de 30 dias.
  - Não guardar os dumps em nuvem pessoal sem criptografia.
  - **Manter ativo**:
    - o que causa a pausa;
    - o e-mail de aviso;
    - como reativar (até 90 dias);
    - uma chamada diária gratuita (ex.: cron-job.org) a `POST <SUPABASE_URL>/rest/v1/rpc/ping`, com os cabeçalhos `apikey: <chave publicável>` e `Content-Type: application/json`;
    - lembrar que o uso diário real do app já gera atividade.

- [ ] **Step 5: Commit**

  ```bash
  git commit -am "feat(backup): backup próprio com retenção de 30 dias e guia para manter o projeto ativo"
  ```

  Incluir os arquivos novos com `git add` antes.

### Task 9: Guia de publicação, mapa de segurança e checklist de lançamento

Pendências: Plano 01 (schema `tests` fora do ambiente hospedado; auth de produção); Plano 03 (conferir Bubblewrap ao gerar o APK).

**Files:**
- Create:
  - `docs/publicacao.md`
  - `docs/seguranca.md`
  - `docs/checklist-lancamento.md`
- Modify:
  - `README.md`: links e comandos novos.
  - `docs/superpowers/specs/2026-10-29-agenda-em-ordem-design.md` §11: nota com a decisão de 2026-11-05 (lançar no gratuito; Pro quando possível) e o que a compensa (Task 8).
  - `docs/guia-apk-android.md`: endereço `*.pages.dev` serve para o `assetlinks.json`.

**Interfaces:** só documentação. Comandos citados precisam existir (`npm run …` das Tasks 7–8 e CLI do Supabase).

- [ ] **Step 1: `docs/publicacao.md`, passo a passo numerado para quem nunca publicou**

  Cada passo diz onde clicar e o que copiar para onde, sem valores inventados.
  1. Criar o projeto Supabase gratuito, região São Paulo (`sa-east-1`), e ativar MFA na conta.
  2. Ligar o repositório ao projeto e aplicar o banco:
     - `npx supabase login`;
     - `npx supabase link --project-ref <ref>`;
     - `npx supabase db push`;
     - **nunca** `--include-seed`: o schema `tests` do seed não pode ir para o ambiente hospedado.
  3. Segredos das funções:
     - `npx supabase secrets set VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:… CRON_SECRET=…`;
     - gerar com `npm run vapid:gerar` numa cópia separada, nunca reaproveitar as chaves locais;
     - depois `npx supabase functions deploy send-reminders send-test-notification delete-account`.
  4. Ligar os lembretes:
     - no SQL Editor, `select public.set_reminder_config('<URL da função send-reminders>', '<CRON_SECRET>');`;
     - avisar que o comando fica no histórico do SQL Editor, como já está em `docs/notificacoes.md`.
  5. Configurar o Auth no painel:
     - Site URL e Redirect URLs com o endereço `*.pages.dev`;
     - confirmação de e-mail ligada;
     - senha mínima 8;
     - SMTP pela opção A (Gmail + senha de app) ou B (domínio + Resend/Brevo);
     - limites de envio;
     - modelos de e-mail em pt-BR.
  6. CAPTCHA (opcional): criar o widget Turnstile; a site key vai no `.env.production.local` e o segredo em Auth › Attack Protection.
  7. Site no Cloudflare Pages:
     - criar o projeto por upload direto;
     - preencher `.env.production.local` a partir do `.env.example`;
     - `npx wrangler login`;
     - `npm run publicar:site`.
  8. Conferências pós-publicação, que remetem a `docs/checklist-lancamento.md`:
     - Security Advisor e Performance Advisor do painel sem alertas críticos;
     - a consulta de privilégios do schema `net` (Task 1) repetida no SQL Editor.
  9. Manter ativo e backups: remete à Task 8.
  10. Atualizações futuras: `db push`, deploy das funções e `publicar:site`, sempre com um backup antes.

- [ ] **Step 2: `docs/seguranca.md`**

  Tabela "requisito → onde é garantido → teste que prova", cobrindo cada item de segurança dos requisitos §15 e §16:
  - RLS e isolamento entre contas;
  - `owner_id` nunca vindo do navegador;
  - segredos fora do bundle (`verificar:producao`);
  - CSP e cabeçalhos;
  - CAPTCHA;
  - limites do Auth;
  - exclusão de conta;
  - exportação;
  - logs sem dados pessoais;
  - nada de analytics.

  Antes de escrever, conferir:
  - `grep -rn "console\." supabase/functions` não loga nome, telefone, observações nem e-mail;
  - `npm audit --omit=dev` sem *high*/*critical*. Se houver, corrigir ou registrar o motivo.

- [ ] **Step 3: `docs/checklist-lancamento.md`**

  Junta `docs/checklist-aparelhos.md` (por referência) com as conferências de produção, uma caixa por item:
  - cadastro com e-mail de confirmação chegando (fora do spam);
  - login com CAPTCHA;
  - recuperar senha;
  - lembrete real no iPhone instalado e no Android;
  - exclusão de conta;
  - `/privacidade` com nome e e-mail;
  - cabeçalhos presentes (`curl -I https://<site>`);
  - backup feito e restauração testada;
  - chamada diária ao `ping` configurada.

- [ ] **Step 4: Rodar a verificação completa na branch**

  Run: `npm run lint && npm run typecheck && npm test && npm run db:test && npm run test:integration && npm run e2e`
  Expected: tudo PASS. Registrar os números no relatório.

- [ ] **Step 5: Commit**

  ```bash
  git commit -am "docs: guia de publicação no plano gratuito, mapa de segurança e checklist de lançamento"
  ```

  Incluir os arquivos novos com `git add` antes.
