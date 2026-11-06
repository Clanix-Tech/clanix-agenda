# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projeto

Clanix Agenda (antes "Agenda em Ordem" — nome que permanece nas specs, planos e telas de `docs/` como registro histórico): PWA em pt-BR para profissionais de beleza organizarem atendimentos. Frontend React 19 + Vite + TypeScript + Tailwind v4 + shadcn/Radix + TanStack Query v5 + react-router; backend Supabase (Postgres com RLS, Auth, Edge Functions em Deno, pg_cron/pg_net, Vault). Publicação planejada no plano gratuito do Supabase + Cloudflare Pages (`docs/publicacao.md`).

Fontes de verdade: requisitos e regras de negócio RN01–RN20 em `docs/superpowers/specs/2026-10-29-agenda-em-ordem-requisitos.md`, design em `docs/superpowers/specs/2026-10-29-agenda-em-ordem-design.md`, contrato do banco em `docs/banco-de-dados.md`. Os planos executados (01–04) estão em `docs/superpowers/plans/`.

## Comandos

```
npm run dev | build | typecheck | lint | format
npm test                         # Vitest: projetos app (jsdom), functions e scripts (node)
npx vitest run src/features/history/exportCsv.test.ts   # um arquivo
npx vitest run -t "nome do teste"                       # por nome
npx vitest run --project functions                      # só um projeto do vitest.config.ts
npm run db:start / db:stop / db:reset
npm run db:test                  # reset + todos os pgTAP de supabase/tests/database
npx supabase test db supabase/tests/database/09_reminders.test.sql      # um arquivo pgTAP (sem reset)
npm run test:integration         # API real (RLS, concorrência, Edge Functions); exige stack local
npm run e2e                      # Playwright no build de produção (vite build --mode test + preview :5174)
npx playwright test auth --project=chromium-desktop     # um spec/projeto
npm run db:types                 # regenera src/types/database.ts após migração (commitar)
npm run vapid:gerar              # chaves VAPID + CRON_SECRET locais em supabase/functions/.env
npm run lembretes:local          # grava URL/segredo do cron no Vault local
npm run verificar:producao | publicar:site | backup:producao
```

Projetos do Playwright: `chromium-desktop` (fuso Europe/Lisbon de propósito), `webkit-iphone`, `chromium-android` (todos com `serviceWorkers: 'block'`) e `pwa` (service worker liberado). Primeira vez na máquina: `npx playwright install chromium webkit`.

## Ambiente local (Windows)

- Supabase local usa portas **4432x** (API 44321, DB 44322, Studio 44323, Mailpit 44324), porque o Windows reserva a faixa 553xx. Nunca fixe portas/chaves no código: leia de `npx supabase status -o json`.
- Existe outro projeto Supabase local do usuário, **`gceu-conecta`** (contêineres `supabase_*_gceu-conecta`). Nunca pare, resete ou rode comandos contra ele: comandos `supabase` só a partir deste repositório, sem `--all`.
- O edge runtime não recarrega sozinho no Windows: depois de mudar `supabase/functions` ou `config.toml`, `npx supabase stop && npx supabase start`. Função nova responde 404 até reiniciar.
- Depois de `db:reset`/`db:test` ou de reiniciar a stack, rode `npm run lembretes:local` antes de integração/e2e de lembretes.
- Deno não está instalado no host. `deno check` das funções roda via Docker (`denoland/deno:2.1.4`) numa **cópia** de `supabase/functions` fora do repo (dentro do repo, o `package.json` faz o Deno resolver `npm:` via `node_modules` e dá erro falso).

## Arquitetura

**Escrita só por RPC.** O navegador lê tabelas (RLS por dono) mas grava agendamentos, expediente e assinaturas push apenas por funções `SECURITY DEFINER` (`create_appointment`, `reschedule_appointment`, `set_business_hours`, `register_push_subscription`…). O dono é sempre `auth.uid()`; nenhuma RPC aceita `owner_id`. Conflito de horário é garantido por `EXCLUDE USING gist` em `appointments` (vale sob concorrência). Histórico é gravado por trigger. Toda função nova: `SECURITY DEFINER`, `set search_path = ''`, `revoke ... from public` e `GRANT EXECUTE` explícito (há um revoke global de privilégios padrão). Funções de backend (`due_reminders`, `claim_reminder`, `release_reminder`, `set_reminder_config`, `record_push_results`) só para `service_role`. Helpers internos ficam no schema `app_private`.

**Erros.** As RPCs respondem códigos `AE001`–`AE006` e `42501` (tabela em `docs/banco-de-dados.md`); `src/lib/errors.ts` (`toAppError`) traduz para mensagens pt-BR e nunca exibe `details`/`hint`. Erros do Auth passam por `src/features/auth/authErrors.ts`.

**Fuso.** O fuso do perfil (`profiles.timezone`) é a fonte de verdade para "dia", expediente e texto dos lembretes — nunca o do navegador ou do servidor (os testes rodam com `TZ=Europe/Lisbon` para pegar isso).

**Frontend.** Organizado por feature em `src/features/<feature>/` (api.ts com queries/mutations, `domain/` com lógica pura testável, `components/`, `pages/`). Rotas em `src/routes.tsx`, todas com `lazy()`; públicas (`/entrar`, `/cadastro`, `/instalar`, `/privacidade`…) ficam fora de `RequireAuth`. `src/lib/env.ts` (`getEnv`) é o único ponto de leitura de variáveis; o frontend só pode usar `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_VAPID_PUBLIC_KEY`, `VITE_APK_DOWNLOAD_URL`, `VITE_TURNSTILE_SITE_KEY`, `VITE_PRIVACY_CONTROLLER_NAME`, `VITE_PRIVACY_CONTACT_EMAIL` (`verificar:producao` recusa qualquer outra). Queries usam `networkMode: 'always'` e não tentam de novo sem rede (`src/lib/queryClient.ts`). Testes de componente usam `src/test/fakeSupabase.ts`, `fakePush.ts` e `render.tsx`; páginas que usam `useCaptcha` o mockam.

**Lembretes push.** pg_cron (a cada minuto) → `app_private.invoke_send_reminders()` → pg_net → Edge Function `send-reminders` (header `x-cron-secret`, URL e segredo no Vault). O SQL decide o que está devido e monta o texto; a função reserva cada lembrete (`claim_reminder`, no máximo um envio por atendimento+horário), envia Web Push com VAPID (até 5 em paralelo), libera a reserva em falha temporária/permanente, apaga aparelhos 404/410 e conta falhas permanentes (`record_push_results`, apaga após 3). No cliente, `src/features/notifications/push.ts` registra/renova a inscrição (troca de chave VAPID detectada por `ensureCurrentKey`) e `AuthProvider` limpa o aparelho ao sair ou trocar de conta.

**Edge Functions.** Cada uma tem `handler.ts` puro (testado no Vitest, projeto `functions`) e `index.ts` que só liga dependências reais (Deno; nunca importado nos testes). Todas com `verify_jwt = false` em `supabase/config.toml`: o handler valida o acesso (JWT do usuário via `auth.getUser`, ou `x-cron-secret`). Imports com versão exata (`npm:@supabase/supabase-js@2.118.0`, `jsr:@supabase/functions-js@2.119.0`). Chave de serviço via `_shared/serviceKey.ts`. `delete-account` exige login por senha nos últimos 300 s (`amr`) e apaga só o `sub` do token; o resto cai por cascata.

**PWA e build.** Service worker próprio (`src/sw.ts`, vite-plugin-pwa `injectManifest`) faz cache só dos arquivos do build — nunca de respostas da API — e trata `push`/`notificationclick`; atualização em modo prompt. O build gera `dist/_headers` (CSP e cabeçalhos, formato Cloudflare Pages; `scripts/gerar-headers.mjs`) e, com `ANDROID_PACKAGE_ID`/`ANDROID_CERT_SHA256`, `.well-known/assetlinks.json`. O `vite preview` aplica o `_headers`, então o e2e roda com a CSP real e falha em qualquer violação no console. Fontes woff2 nunca são embutidas como `data:` (a CSP bloqueia).

## Convenções do produto

- Texto da interface em pt-BR simples; datas `DD/MM/AAAA`, 24 h.
- Estilo "Painel em Blocos" (telas de referência em `docs/design/telas/`) na **identidade visual Clanix** (spec `docs/superpowers/specs/2026-11-06-identidade-visual-clanix-design.md`): primário `#4A00B8` no tema claro e `#8A2BE2` no escuro, títulos/texto `#0B0420`, erro/destrutivo `#B91C1C`; fontes Sora (títulos) + Inter (texto).
- Cores e raios só por tokens semânticos de `src/styles/index.css` (`bg-card`, `text-foreground`, `bg-primary`…): nunca hex nos componentes. Guardas: `src/styles/cores.test.ts` (sem hex fora dos tokens) e `src/styles/contraste.test.ts` (contraste AA nos dois temas). Gradientes só onde a spec permite (`bg-gradient-brand` nos CTAs das telas de entrada, `bg-gradient-destaque` no card "Próximo atendimento", `bg-gradient-fab`, `bg-gradient-hero`).
- Tema claro/escuro/automático: `public/tema.js` (script clássico no `<head>`, aplica `dark` e `theme-color` antes da primeira pintura, por causa da CSP) + `src/lib/theme.ts` (`useTheme`, chave `clanix-tema`); as duas partes seguem a mesma regra. Escolha em Ajustes › Aparência.
- Logo e ícones oficiais em `src/assets/brand/`, copiados do guia de marca por `npm run marca:copiar` (`scripts/copiar-marca.mjs`); `npm run dados:teste` recria os dados da conta de teste local.
- Alvos de toque ≥ 44 px; inputs ≥ 16 px no celular; foco visível; status com ícone + texto + cor.
- Nada de botão ou funcionalidade falsa; nada de dados de clientes em `localStorage`/Cache Storage; logs só com ids e códigos (sem nome, telefone, observações ou e-mail); nada de analytics.
- Segredos (service role/`sb_secret_*`, chave privada VAPID, `CRON_SECRET`, segredo Turnstile, URL do banco) só em `*.local`, secrets das funções ou Vault — nunca no repo ou no bundle. Não inventar valores de serviços externos: documentar o que o usuário precisa configurar.
