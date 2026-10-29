# Plano 01 — Fundação e Banco de Dados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o projeto (tooling) e todo o banco do Agenda em Ordem — tabelas, RLS, regras de agendamento (RN01–RN20), histórico à prova de adulteração e funções RPC — testado localmente com pgTAP e testes de integração/concorrência.

**Architecture:** Repositório único com app Vite/React (só o esqueleto neste plano) e pasta `supabase/` com migrações versionadas. O navegador só **lê** agendamentos (RLS por dono); toda escrita de agendamento passa por funções `SECURITY DEFINER` em `public` que obtêm o dono por `auth.uid()`; validações internas e triggers ficam no schema não exposto `app_private`. Conflitos são garantidos por restrição de exclusão `btree_gist` (eficaz sob concorrência); o histórico é gravado por trigger na mesma transação.

**Tech Stack:** Node 24, Vite + React + TypeScript (strict), ESLint (flat config), Prettier, Vitest, Supabase CLI (via `npx`, Docker local), PostgreSQL + pgTAP, `@supabase/supabase-js`.

**Spec:** `docs/superpowers/specs/2026-10-29-agenda-em-ordem-design.md` (aprovado) + `docs/superpowers/specs/2026-10-29-agenda-em-ordem-requisitos.md`. Leia os dois antes de começar.

**Fora deste plano (planos seguintes):** Plano 02 — interface (Tailwind/tokens, layout Painel em Blocos, auth UI, dashboard, agenda, formulários, histórico, configurações), só após o usuário aprovar as telas; Plano 03 — PWA, Web Push (`send-reminders`, pg_cron), tela de Notificações, APK TWA; Plano 04 — exclusão de conta (Edge Function), revisão de segurança final, deploy.

## Global Constraints

- TypeScript `strict: true`; nenhum `any` implícito.
- Usar versões estáveis atuais; conferir APIs na documentação oficial; não fixar versões inventadas.
- Nenhum segredo no repositório. `.env*` (exceto `.env.example`) no `.gitignore`. Chaves locais do Supabase só via `npx supabase status -o env` em tempo de execução.
- Instantes em `timestamptz`; fuso do **perfil** é a fonte de verdade; padrão `America/Sao_Paulo`.
- Status (enum `appointment_status`): `agendado`, `concluido`, `cancelado`, `nao_compareceu`.
- Restrição de exclusão: `EXCLUDE USING gist (owner_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE (status <> 'cancelado')`.
- Expediente inicial sugerido (usado pela UI no Plano 02, e pelos testes aqui): seg–sex `09:00–12:00` e `13:00–18:00`.
- Registros com início no passado (`p_confirm_past = true`) são isentos do expediente, mas não de conflito nem da regra da meia-noite.
- Dono sempre por `auth.uid()`; nenhuma função aceita `owner_id` como parâmetro.
- `anon` não tem acesso a nenhuma tabela nem função do app.
- Funções `SECURITY DEFINER` com `set search_path = ''` e nomes totalmente qualificados.
- Horários com precisão de minuto (segundos e frações = 0).
- Mensagens e documentação em português do Brasil.

## Review Focus

1. Instante enviado com offsets diferentes (`17:00Z` vs `14:00-03:00`) deve ser tratado como o mesmo horário e conflitar → teste na Task 7.
2. Nome/serviço só com espaços, ou texto acima do limite, deve ser rejeitado no banco mesmo que a UI seja burlada → teste na Task 6.
3. Telefone com letras, emoji ou HTML deve ser rejeitado → teste na Task 6.
4. Atendimento terminando exatamente à meia-noite (ex.: 23:00–00:00) deve ser rejeitado como "atravessa a meia-noite" (AE003), sem estourar erro genérico → teste na Task 7.
5. Horário com segundos (`14:00:30`) ou duração acima de 12 h deve ser rejeitado por constraint → teste na Task 6.

## Códigos de erro do domínio (contrato com o frontend)

Todas as RPCs sinalizam erros de regra com `raise exception using errcode = '<código>', message = '<chave>'`. O Plano 02 traduz o código para português.

| errcode | message | Quando |
|---|---|---|
| `AE001` | `horario_indisponivel` | Sobreposição (captura `exclusion_violation` 23P01) |
| `AE002` | `fora_do_expediente` | Intervalo não cabe inteiro num turno do dia (início futuro) |
| `AE003` | `atravessa_meia_noite` | Data local de início ≠ data local de fim |
| `AE004` | `horario_passado_sem_confirmacao` | Início < `now()` sem `p_confirm_past` |
| `AE005` | `transicao_invalida` | Ação não permitida no status atual |
| `AE006` | `agendamento_nao_encontrado` | Id inexistente **ou de outro dono** (não revelar existência) |
| `42501` | `nao_autenticado` | `auth.uid()` nulo |

## Estrutura de arquivos

```
package.json, tsconfig*.json, vite.config.ts, eslint.config.js, .prettierrc, .gitignore, .env.example, README.md
src/main.tsx, src/App.tsx                     # esqueleto mínimo (UI vem no Plano 02)
src/types/database.ts                         # gerado pelo Supabase CLI (Task 10)
supabase/config.toml                          # gerado por `supabase init`, ajustado
supabase/seed.sql                             # SÓ helpers de teste (schema `tests`), nunca dados fictícios
supabase/migrations/
  20261029000100_base.sql                     # extensões, schema app_private, tipos, set_updated_at
  20261029000200_profiles.sql
  20261029000300_business_hours.sql
  20261029000400_favorite_services.sql
  20261029000500_appointments.sql             # tabela, exclusão, histórico + trigger
  20261029000600_appointment_rpc_create_reschedule.sql
  20261029000700_appointment_rpc_status.sql
  20261029000800_notifications.sql
supabase/tests/database/
  00_smoke.test.sql, 01_profiles.test.sql, 02_business_hours.test.sql, 03_favorite_services.test.sql,
  04_appointments_constraints.test.sql, 05_rpc_create_reschedule.test.sql, 06_rpc_status.test.sql,
  07_notifications.test.sql
tests/integration/
  helpers.ts, rls-api.test.ts, concurrency.test.ts
vitest.config.ts, vitest.integration.config.ts
docs/banco-de-dados.md, docs/supabase-local.md
```

---

### Task 1: Esqueleto do projeto e ferramentas de qualidade

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `eslint.config.js`, `.prettierrc`, `.prettierignore`, `.gitignore`, `.env.example`, `README.md`, `index.html`, `src/main.tsx`, `src/App.tsx`, `vitest.config.ts`
- Test: `src/App.test.tsx`

**Interfaces:**
- Produces: scripts npm `dev`, `build`, `typecheck` (`tsc -b --noEmit` ou equivalente), `lint`, `format`, `test` (vitest run, unitários), `test:integration` (Task 10).

- [ ] **Step 1:** Gerar o app com `npm create vite@latest . -- --template react-ts` (diretório já contém `docs/` e o PNG da marca — manter). Ativar `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride` no tsconfig da app.
- [ ] **Step 2:** Adicionar Prettier, Vitest, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`. `vitest.config.ts` com `environment: 'jsdom'`, `include: ['src/**/*.test.{ts,tsx}']`.
- [ ] **Step 3: Teste que falha** — `src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import App from './App';
it('mostra o nome do produto', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Agenda em Ordem' })).toBeInTheDocument();
});
```

- [ ] **Step 4:** Rodar `npm test` → FAIL (template padrão não tem esse heading).
- [ ] **Step 5:** `App.tsx` renderiza `<h1>Agenda em Ordem</h1>` e o slogan "Tudo organizado em um só lugar." (`<html lang="pt-BR">` no `index.html`). Remover assets do template.
- [ ] **Step 6:** `.gitignore` inclui `node_modules`, `dist`, `.env`, `.env.*` com exceção `!.env.example`, `supabase/.temp`, `supabase/.branches`, `*.keystore`, `*.jks`. `.env.example` com `VITE_SUPABASE_URL=` e `VITE_SUPABASE_PUBLISHABLE_KEY=` (vazios, comentados em pt-BR). README com descrição curta e comandos.
- [ ] **Step 7:** Rodar `npm run typecheck && npm run lint && npm test && npm run build` → tudo passa, 1 teste PASS.
- [ ] **Step 8: Commit** — `git add` dos arquivos acima + `Guia de Marca Agenda em Ordem.png`; `git commit -m "chore: esqueleto Vite/React/TS com lint, prettier e vitest"`.

### Task 2: Supabase local, helpers de teste e teste de fumaça

**Files:**
- Create: `supabase/config.toml` (via `npx supabase init`), `supabase/seed.sql`, `supabase/tests/database/00_smoke.test.sql`, `supabase/migrations/20261029000100_base.sql`, `docs/supabase-local.md`
- Modify: `package.json` (devDependency `supabase`, scripts)

**Interfaces:**
- Produces (migração base):
  - extensões `btree_gist` e `pgcrypto` (schema `extensions`); `pgtap` só nos testes (`create extension if not exists pgtap with schema extensions` no início de cada arquivo de teste).
  - schema `app_private` (sem `usage` para `anon`/`authenticated`).
  - `create type public.appointment_status as enum ('agendado','concluido','cancelado','nao_compareceu')`
  - `create type public.history_action as enum ('criado','editado','remarcado','status_alterado','cancelado','reativado')`
  - `create type public.timerange as range (subtype = time)`
  - `app_private.set_updated_at() returns trigger` — `new.updated_at := now()`.
  - `alter default privileges in schema public revoke all on tables from anon, authenticated;` e o mesmo para `functions` (`revoke execute ... from public, anon`) — toda permissão é concedida explicitamente nas migrações seguintes.
- Produces (`supabase/seed.sql`, só local — schema `tests`):
  - `tests.create_user(p_email text, p_display_name text default null) returns uuid` — insere em `auth.users` (email confirmado, `raw_user_meta_data` com `display_name` quando informado).
  - `tests.authenticate_as(p_user uuid) returns void` — `set_config('role','authenticated',true)` e `set_config('request.jwt.claims', json_build_object('sub',p_user,'role','authenticated')::text, true)`.
  - `tests.authenticate_anon() returns void` — role `anon`, claims `{"role":"anon"}`.
  - `tests.reset_role() returns void` — volta para `postgres` (`set_config('role','postgres',true)` e limpa claims).
  - `tests.set_default_hours(p_user uuid) returns void` — insere seg–sex (weekday 1..5) `09:00–12:00` e `13:00–18:00` diretamente.
  - `tests.local_ts(p_days_from_next_monday int, p_time time, p_tz text default 'America/Sao_Paulo') returns timestamptz` — segunda-feira da **próxima** semana no fuso `p_tz`, + dias, + hora, convertido para `timestamptz`. Para datas passadas os testes usam `date_trunc('minute', now()) - interval …` diretamente.
  - `grant usage on schema tests` e `grant execute on all functions in schema tests` para `anon, authenticated` — necessário para chamar `tests.reset_role()`/`tests.local_ts()` depois de trocar de papel. Aceitável porque `seed.sql` só roda no banco local e o schema `tests` não é exposto pela API.
- Scripts npm: `db:start` (`supabase start`), `db:stop`, `db:reset` (`supabase db reset`), `db:test` (`supabase db reset && supabase test db`), `db:types` (Task 10).

- [ ] **Step 1:** `npm i -D supabase`; `npx supabase init`. Em `config.toml`: `[auth] site_url = "http://localhost:5173"`, `enable_confirmations = false` só no bloco local de e-mail (comentário: produção liga confirmação, ver design §11). Não alterar portas.
- [ ] **Step 2: Teste que falha** — `00_smoke.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);
select has_extension('btree_gist');
select has_type('public', 'appointment_status');
select enum_has_labels('public', 'appointment_status', array['agendado','concluido','cancelado','nao_compareceu']);
select has_schema('app_private');
select ok(tests.local_ts(0, '14:00') > now(), 'local_ts aponta para o futuro');
select * from finish();
rollback;
```

- [ ] **Step 3:** `npm run db:start` (primeira vez baixa imagens) e `npm run db:test` → FAIL (tipos/schema inexistentes).
- [ ] **Step 4:** Escrever `20261029000100_base.sql` e `seed.sql` conforme Interfaces.
- [ ] **Step 5:** `npm run db:test` → `00_smoke.test.sql .. ok`, 5/5.
- [ ] **Step 6:** `docs/supabase-local.md`: pré-requisitos (Docker), comandos, como ver chaves locais (`npx supabase status`), aviso de que `seed.sql` contém só helpers de teste.
- [ ] **Step 7: Commit** — `git commit -m "chore(db): supabase local, migração base e helpers de teste"`.

### Task 3: Perfis (`profiles`) com criação automática e RLS

**Files:**
- Create: `supabase/migrations/20261029000200_profiles.sql`, `supabase/tests/database/01_profiles.test.sql`

**Interfaces:**
- Consumes: Task 2 (`app_private`, `set_updated_at`, helpers).
- Produces: `public.profiles`:
  - `id uuid primary key references auth.users(id) on delete cascade`
  - `display_name text not null check (char_length(btrim(display_name)) between 1 and 80)`
  - `business_name text check (business_name is null or char_length(btrim(business_name)) between 1 and 80)`
  - `timezone text not null default 'America/Sao_Paulo'` (validado por trigger contra `pg_timezone_names`)
  - `default_duration_minutes int not null default 60 check (between 5 and 480)`
  - `slot_interval_minutes int not null default 30 check (in (15,30,60))`
  - `week_starts_on smallint not null default 1 check (between 0 and 6)` (0 = domingo)
  - `default_view text not null default 'semana' check (in ('dia','semana','mes','lista'))`
  - `reminder_minutes int default 30 check (reminder_minutes is null or reminder_minutes in (15,30,60))`
  - `hide_client_name_in_notifications boolean not null default false`
  - `created_at`, `updated_at timestamptz not null default now()`
  - `app_private.handle_new_user()` (trigger `after insert on auth.users`, `security definer`): cria perfil com `display_name = coalesce(nullif(btrim(raw_user_meta_data->>'display_name'),''), split_part(email,'@',1))`.
  - Grants: `authenticated`: `select`; `update (display_name, business_name, timezone, default_duration_minutes, slot_interval_minutes, week_starts_on, default_view, reminder_minutes, hide_client_name_in_notifications)`. Sem insert/delete. RLS: `using (id = auth.uid())` / `with check (id = auth.uid())`.

- [ ] **Step 1: Testes que falham** — `01_profiles.test.sql` com `plan` cobrindo:
  - `create_user('a@x.com','Camila')` cria perfil com `display_name = 'Camila'`, `timezone = 'America/Sao_Paulo'`, `reminder_minutes = 30`.
  - Sem metadata → `display_name = 'b'` para `b@x.com`.
  - Como A: `select count(*) from profiles` = 1 (só o próprio).
  - Como A: `update profiles set display_name='X' where id = <B>` afeta 0 linhas (verificar via `reset_role` que B não mudou).
  - Como A: `update profiles set id = <novo uuid>` → `throws_ok` (sem privilégio de coluna, 42501).
  - Como A: `insert into profiles` e `delete from profiles` → `throws_ok '42501'`.
  - `update ... set timezone = 'Marte/Base'` → `throws_ok` (errcode `22023`, message `fuso_invalido`).
  - `slot_interval_minutes = 20` → `throws_ok '23514'`.
  - Anon: `select * from profiles` → `throws_ok '42501'`.
  - Excluir o usuário de `auth.users` (como postgres) remove o perfil.
- [ ] **Step 2:** `npm run db:test` → FAIL em `01_profiles`.
- [ ] **Step 3:** Escrever a migração (tabela, trigger de fuso `app_private.validate_profile()` levantando `22023`/`fuso_invalido`, trigger `updated_at`, trigger de novo usuário, RLS, grants).
- [ ] **Step 4:** `npm run db:test` → todos PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(db): perfis com criação automática e RLS"`.

### Task 4: Expediente (`business_hours`) e `set_business_hours`

**Files:**
- Create: `supabase/migrations/20261029000300_business_hours.sql`, `supabase/tests/database/02_business_hours.test.sql`

**Interfaces:**
- Consumes: `public.profiles`, `public.timerange`.
- Produces:
  - `public.business_hours(id uuid pk default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade, weekday smallint not null check (weekday between 0 and 6), start_time time not null, end_time time not null, check (end_time > start_time), check (start_time = date_trunc('minute', start_time) and end_time = date_trunc('minute', end_time)))` + `exclude using gist (owner_id with =, weekday with =, public.timerange(start_time, end_time, '[)') with &&)` + índice `(owner_id, weekday)`.
  - `public.set_business_hours(p_shifts jsonb) returns setof public.business_hours` — `security definer`; `p_shifts` = array de `{"weekday": int, "start_time": "HH:MM", "end_time": "HH:MM"}`; apaga os turnos do usuário e insere os novos **na mesma transação**; máximo 21 turnos (`22023`/`expediente_invalido` acima disso); sobreposição entre turnos → `22023`/`expediente_invalido`; retorna os turnos ordenados por `weekday, start_time`.
  - Grants: `authenticated`: `select` na tabela (RLS `owner_id = auth.uid()`), `execute` na função. Sem insert/update/delete diretos.

- [ ] **Step 1: Testes que falham** — `02_business_hours.test.sql`:
  - Como A: `set_business_hours('[{"weekday":1,"start_time":"09:00","end_time":"12:00"},{"weekday":1,"start_time":"13:00","end_time":"18:00"}]')` retorna 2 linhas; `select count(*)` = 2.
  - Chamar de novo com 1 turno → count = 1 (substituição, não acumula).
  - Turnos sobrepostos (`09:00–12:00` e `11:00–14:00` no mesmo dia) → `throws_ok '22023'` **e** os turnos anteriores permanecem (count inalterado).
  - `end_time <= start_time` → `throws_ok '22023'`.
  - `"09:00:30"` → `throws_ok '22023'`.
  - Como B: `select count(*) from business_hours` = 0 com turnos de A existentes.
  - Como A: `insert into business_hours ...` direto → `throws_ok '42501'`.
  - Anon: `set_business_hours('[]')` → `throws_ok '42501'`.
- [ ] **Step 2:** `npm run db:test` → FAIL.
- [ ] **Step 3:** Escrever a migração (converter `23P01`/`23514` em `22023`/`expediente_invalido` dentro da função).
- [ ] **Step 4:** `npm run db:test` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(db): expediente com turnos e substituição atômica"`.

### Task 5: Serviços favoritos (`favorite_services`)

**Files:**
- Create: `supabase/migrations/20261029000400_favorite_services.sql`, `supabase/tests/database/03_favorite_services.test.sql`

**Interfaces:**
- Produces: `public.favorite_services(id uuid pk default gen_random_uuid(), owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade, name text not null check (char_length(btrim(name)) between 1 and 80), duration_minutes int not null check (between 5 and 480), color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'), is_active boolean not null default true, created_at, updated_at)`; `unique (owner_id, lower(btrim(name)))` (índice único por expressão).
  - Grants `authenticated`: `select`, `insert (name, duration_minutes, color, is_active)`, `update (name, duration_minutes, color, is_active)`, `delete`. RLS: todas as políticas `owner_id = auth.uid()` (insert com `with check`).

- [ ] **Step 1: Testes que falham** — `03_favorite_services.test.sql`:
  - Como A: insert `('Manicure', 45)` → `owner_id = A` sem informar owner.
  - Como A: insert com `owner_id = B` explícito → `throws_ok '42501'` (sem privilégio de coluna).
  - Como A: `update ... set owner_id = B` → `throws_ok '42501'`.
  - Como B: não vê, não altera (0 linhas), não apaga (0 linhas) o serviço de A.
  - `color = 'red'` → `throws_ok '23514'`; `duration_minutes = 0` → `23514`; nome `'   '` → `23514`.
  - Duplicado `'manicure '` para A → `throws_ok '23505'`; mesmo nome para B → ok.
- [ ] **Step 2:** `npm run db:test` → FAIL.
- [ ] **Step 3:** Escrever a migração.
- [ ] **Step 4:** `npm run db:test` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(db): serviços favoritos com RLS"`.

### Task 6: Agendamentos — tabela, restrição de conflito e histórico automático

**Files:**
- Create: `supabase/migrations/20261029000500_appointments.sql`, `supabase/tests/database/04_appointments_constraints.test.sql`

**Interfaces:**
- Produces: `public.appointments`:
  - `id uuid pk default gen_random_uuid()`, `owner_id uuid not null references public.profiles(id) on delete cascade`
  - `client_name text not null check (client_name = btrim(client_name) and char_length(client_name) between 1 and 120)`
  - `client_phone text check (client_phone is null or (char_length(client_phone) between 8 and 20 and client_phone ~ '^[0-9()+ -]+$'))`
  - `service_name text not null check (service_name = btrim(service_name) and char_length(service_name) between 1 and 120)`
  - `starts_at timestamptz not null`, `ends_at timestamptz not null`
  - `check (ends_at > starts_at)`, `check (ends_at - starts_at <= interval '12 hours')`, `check (starts_at = date_trunc('minute', starts_at) and ends_at = date_trunc('minute', ends_at))`
  - `status public.appointment_status not null default 'agendado'`
  - `notes text check (notes is null or char_length(notes) <= 1000)`
  - `cancellation_reason text check (cancellation_reason is null or char_length(cancellation_reason) <= 300)`
  - `canceled_at timestamptz`, `check ((status = 'cancelado') = (canceled_at is not null))`
  - `created_at`, `updated_at`
  - `constraint appointments_no_overlap exclude using gist (owner_id with =, tstzrange(starts_at, ends_at, '[)') with &&) where (status <> 'cancelado')`
  - índice `(owner_id, starts_at)`.
- Produces: `public.appointment_history(id uuid pk default gen_random_uuid(), appointment_id uuid not null references public.appointments(id) on delete cascade, owner_id uuid not null references public.profiles(id) on delete cascade, actor_id uuid, action public.history_action not null, previous_values jsonb, new_values jsonb not null, created_at timestamptz not null default now())` + índice `(appointment_id, created_at)`.
- Produces: `app_private.record_appointment_history()` — trigger `after insert or update on public.appointments`, `security definer`. Ação:
  - insert → `criado` (`previous_values = null`, `new_values` = linha completa sem `owner_id`).
  - status `cancelado` → `agendado` → `reativado`; qualquer → `cancelado` → `cancelado`; outra mudança de status → `status_alterado`;
  - senão, mudou `starts_at`/`ends_at` → `remarcado`; senão, mudou `client_name`/`client_phone`/`service_name`/`notes` → `editado`;
  - `previous_values`/`new_values` contêm **só os campos alterados** (e `status` quando muda); `actor_id = auth.uid()`; update sem mudança de campos relevantes não grava.
- Grants: `authenticated`: só `select` em `appointments` e `appointment_history` (RLS `owner_id = auth.uid()`). Nenhum insert/update/delete para `authenticated`/`anon`.

- [ ] **Step 1: Testes que falham** — `04_appointments_constraints.test.sql` (inserções como `postgres`, salvo indicado; datas via `tests.local_ts`):
  - **RN03 conflito parcial:** A tem 14:00–15:00; inserir 14:30–15:30 → `throws_ok '23P01'`.
  - **Conflito total:** 14:00–15:00 de novo → `23P01`; 13:00–16:00 (envolve) → `23P01`.
  - **RN04 adjacente:** 15:00–16:00 → `lives_ok`.
  - **RN05:** cancelar o 14:00–15:00 (`status='cancelado', canceled_at=now()`) e inserir 14:30–15:30 → `lives_ok`.
  - **RN06:** status `concluido` e `nao_compareceu` continuam bloqueando → `23P01`.
  - **RN19:** B no mesmo horário de A → `lives_ok`.
  - **RN09/RN10:** `ends_at = starts_at` e `ends_at < starts_at` → `23514`.
  - Review Focus 2: `client_name = '   '`, `' Ana'`, 121 caracteres → `23514`.
  - Review Focus 3: `client_phone = 'abc12345'`, `'<b>1234</b>'` → `23514`; `'(11) 98765-4321'` → ok.
  - Review Focus 5: `starts_at` com `:30` segundos → `23514`; duração de 13 h → `23514`.
  - `status='cancelado'` sem `canceled_at` → `23514`.
  - **Histórico:** após o insert existe 1 linha `criado`; update de `starts_at/ends_at` gera `remarcado` com `previous_values ? 'starts_at'`; update de `notes` gera `editado` só com `notes`; cancelamento gera `cancelado`; volta para `agendado` gera `reativado`.
  - **Permissões:** como A: `insert into appointments`, `update appointments`, `delete from appointments`, `insert/update/delete appointment_history` → `throws_ok '42501'`; `select` de A vê só os seus; B vê 0 de A em ambas as tabelas.
  - Excluir usuário A (postgres) remove seus agendamentos e histórico.
- [ ] **Step 2:** `npm run db:test` → FAIL.
- [ ] **Step 3:** Escrever a migração.
- [ ] **Step 4:** `npm run db:test` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(db): agendamentos com bloqueio de conflito e histórico automático"`.

### Task 7: RPCs `create_appointment` e `reschedule_appointment` (expediente, meia-noite, passado, fuso)

**Files:**
- Create: `supabase/migrations/20261029000600_appointment_rpc_create_reschedule.sql`, `supabase/tests/database/05_rpc_create_reschedule.test.sql`

**Interfaces:**
- Consumes: Tasks 3, 4, 6; códigos de erro da tabela acima.
- Produces (internas, `app_private`, `security definer`, sem grant para clientes):
  - `app_private.require_user() returns uuid` — `auth.uid()` ou `42501`/`nao_autenticado`.
  - `app_private.assert_valid_slot(p_owner uuid, p_starts timestamptz, p_ends timestamptz, p_confirm_past boolean) returns void` — na ordem: (1) datas locais (fuso do perfil) de início e fim diferentes → `AE003`; (2) `p_starts < now()` e não `p_confirm_past` → `AE004`; (3) se `p_starts >= now()`, exige turno de `business_hours` com `weekday = extract(dow from início local)`, `start_time <= hora local de início` e `end_time >= hora local de fim` → senão `AE002`.
  - `app_private.load_own_appointment(p_id uuid, p_owner uuid) returns public.appointments` — `select ... for update`; inexistente ou de outro dono → `AE006`.
- Produces (públicas, `security definer`, `grant execute to authenticated`):
  - `public.create_appointment(p_client_name text, p_service_name text, p_starts_at timestamptz, p_ends_at timestamptz, p_client_phone text default null, p_notes text default null, p_confirm_past boolean default false) returns public.appointments` — aplica `btrim` em nome/serviço, `nullif(btrim(...),'')` em telefone/observações; `assert_valid_slot`; insert com `owner_id = require_user()`; `23P01` → `AE001`.
  - `public.reschedule_appointment(p_id uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_confirm_past boolean default false) returns public.appointments` — só status `agendado` (senão `AE005`); `assert_valid_slot`; update de `starts_at/ends_at` apenas; `23P01` → `AE001` e a linha original permanece intacta.

- [ ] **Step 1: Testes que falham** — `05_rpc_create_reschedule.test.sql` (A com `tests.set_default_hours`; `d0 = tests.local_ts(0, …)` é segunda):
  - Criar seg 14:00–15:00 como A → retorna linha `agendado`, `owner_id = A`.
  - Mesmo slot de novo → `throws_ok 'AE001'`; seg 15:00–16:00 → ok.
  - **Review Focus 1:** o mesmo instante enviado como `'…T17:00:00Z'` e como `'…T14:00:00-03:00'` (via `tests.local_ts` + `at time zone 'UTC'`) → o segundo dá `AE001`.
  - Fora do expediente (seg 12:00–13:00, seg 17:30–18:30, sábado 10:00) → `AE002`.
  - Exatamente o limite do turno (seg 17:00–18:00, 09:00–10:00) → ok.
  - **Review Focus 4:** seg 23:00 → ter 00:00 com `p_confirm_past=false` → `AE003` (mesmo fora do expediente, AE003 vem primeiro).
  - Passado (ontem 10:00–11:00) sem confirmação → `AE004`; com confirmação → ok; passado no **domingo 20:00** com confirmação → ok (isento de expediente); passado sobrepondo outro passado → `AE001`.
  - **Fuso:** perfil de B com `timezone = 'America/Manaus'` e expediente 09–18; criar 09:00 local de Manaus (= 10:00 de São Paulo) → ok; 08:30 local de Manaus → `AE002`.
  - `reschedule_appointment` para slot livre → ok, histórico `remarcado` com horários antigos e novos.
  - Remarcar para horário ocupado → `AE001` e `select starts_at` mostra o horário original.
  - Remarcar agendamento `concluido` → `AE005`.
  - B remarcando agendamento de A → `AE006`; id aleatório → `AE006`.
  - Anon chamando `create_appointment` → `throws_ok '42501'`.
  - Nome `'  Ana  '` é gravado como `'Ana'`; telefone `''` vira `null`.
- [ ] **Step 2:** `npm run db:test` → FAIL.
- [ ] **Step 3:** Escrever a migração.
- [ ] **Step 4:** `npm run db:test` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(db): RPCs de criação e remarcação com expediente e fuso"`.

### Task 8: RPCs de edição, status, cancelamento e reativação

**Files:**
- Create: `supabase/migrations/20261029000700_appointment_rpc_status.sql`, `supabase/tests/database/06_rpc_status.test.sql`

**Interfaces:**
- Consumes: `app_private.require_user`, `load_own_appointment`, `assert_valid_slot` (Task 7).
- Produces (`security definer`, `grant execute to authenticated`):
  - `public.update_appointment_details(p_id uuid, p_client_name text, p_service_name text, p_client_phone text default null, p_notes text default null) returns public.appointments` — permitido em `agendado`, `concluido`, `nao_compareceu`; `cancelado` → `AE005`. Não altera horário.
  - `public.set_appointment_status(p_id uuid, p_status public.appointment_status) returns public.appointments` — transições permitidas: `agendado→concluido`, `agendado→nao_compareceu`, `concluido↔nao_compareceu`, `concluido→agendado`, `nao_compareceu→agendado`. Qualquer outra (inclusive envolvendo `cancelado` ou igual à atual) → `AE005`.
  - `public.cancel_appointment(p_id uuid, p_reason text default null) returns public.appointments` — só de `agendado`; grava `canceled_at = now()`, `cancellation_reason = nullif(btrim(p_reason),'')`.
  - `public.reactivate_appointment(p_id uuid) returns public.appointments` — só de `cancelado`; chama `assert_valid_slot(..., p_confirm_past => true)` (passado continua isento de expediente, futuro valida expediente); limpa `canceled_at` e `cancellation_reason`; `23P01` → `AE001` e permanece cancelado.

- [ ] **Step 1: Testes que falham** — `06_rpc_status.test.sql`:
  - Editar detalhes em `agendado`, `concluido`, `nao_compareceu` → ok, histórico `editado`; em `cancelado` → `AE005`.
  - Todas as transições permitidas → ok e histórico `status_alterado` (com status anterior e novo); `agendado→agendado`, `cancelado→concluido`, `concluido→cancelado` (via `set_appointment_status`) → `AE005`.
  - Cancelar `agendado` com motivo `'  Imprevisto '` → `status='cancelado'`, motivo `'Imprevisto'`, registro continua existindo, histórico `cancelado`.
  - Cancelar `concluido` → `AE005`. Motivo com 301 caracteres → `23514`.
  - Reativar com horário livre → `agendado`, `canceled_at` nulo, histórico `reativado`.
  - Reativar quando outro agendamento ocupou o horário → `AE001` e o registro continua `cancelado`.
  - Reativar agendamento futuro cujo horário saiu do expediente (expediente alterado depois) → `AE002`.
  - B chamando qualquer uma das 4 funções com id de A → `AE006`; o registro de A não muda.
- [ ] **Step 2:** `npm run db:test` → FAIL.
- [ ] **Step 3:** Escrever a migração.
- [ ] **Step 4:** `npm run db:test` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(db): edição, status, cancelamento e reativação"`.

### Task 9: Tabelas de notificação (assinaturas push e controle de lembretes)

**Files:**
- Create: `supabase/migrations/20261029000800_notifications.sql`, `supabase/tests/database/07_notifications.test.sql`

**Interfaces:**
- Produces:
  - `public.push_subscriptions(id uuid pk default gen_random_uuid(), owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade, endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 2048), p256dh text not null check (char_length(p256dh) <= 200), auth text not null check (char_length(auth) <= 100), device_label text check (device_label is null or char_length(device_label) <= 80), created_at timestamptz not null default now(), last_used_at timestamptz)`. Grants `authenticated`: `select`, `insert (endpoint, p256dh, auth, device_label)`, `delete`; RLS por dono.
  - `public.appointment_reminders(appointment_id uuid not null references public.appointments(id) on delete cascade, starts_at timestamptz not null, sent_at timestamptz not null default now(), primary key (appointment_id, starts_at))`. **Nenhum** grant para `anon`/`authenticated` (só o backend com service role, Plano 03); RLS habilitado sem políticas.

- [ ] **Step 1: Testes que falham** — `07_notifications.test.sql`:
  - Como A: insert de assinatura sem `owner_id` → `owner_id = A`; B não vê nem apaga.
  - Como A: `update push_subscriptions set owner_id = B` → `42501`; endpoint `http://…` → `23514`.
  - Endpoint duplicado → `23505`.
  - Como A e como anon: `select * from appointment_reminders` → `42501`.
  - Excluir usuário A remove suas assinaturas.
- [ ] **Step 2:** `npm run db:test` → FAIL.
- [ ] **Step 3:** Escrever a migração.
- [ ] **Step 4:** `npm run db:test` → PASS (todos os arquivos 00–07).
- [ ] **Step 5: Commit** — `git commit -m "feat(db): tabelas de assinaturas push e controle de lembretes"`.

### Task 10: Testes via API (RLS e concorrência), tipos gerados e documentação do banco

**Files:**
- Create: `tests/integration/helpers.ts`, `tests/integration/rls-api.test.ts`, `tests/integration/concurrency.test.ts`, `vitest.integration.config.ts`, `src/types/database.ts` (gerado), `docs/banco-de-dados.md`
- Modify: `package.json` (dependência `@supabase/supabase-js`; scripts `test:integration`, `db:types`), `README.md`

**Interfaces:**
- Consumes: todas as RPCs e tabelas acima.
- Produces:
  - `tests/integration/helpers.ts`: `getLocalEnv(): { url: string; anonKey: string; serviceRoleKey: string }` (lê `npx supabase status -o json` em tempo de execução; nunca de arquivo versionado); `createTestUser(email: string): Promise<{ id: string; client: SupabaseClient<Database> }>` (cria via admin API com e-mail confirmado e faz login com senha aleatória); `setDefaultHours(client): Promise<void>` (chama `set_business_hours` com seg–sex 09–12 / 13–18); `nextMondayAt(hhmm: string, tz?: string): string` (ISO com offset).
  - Script `db:types`: `supabase gen types typescript --local > src/types/database.ts`.
  - Script `test:integration`: `vitest run --config vitest.integration.config.ts` (ambiente `node`, `include: ['tests/integration/**/*.test.ts']`, `fileParallelism: false`).

- [ ] **Step 1: Teste de concorrência que falha** — `concurrency.test.ts`:

```ts
it('RN08: 10 reservas simultâneas do mesmo horário resultam em exatamente 1 sucesso', async () => {
  const { client } = await createTestUser(`conc-${crypto.randomUUID()}@teste.local`);
  await setDefaultHours(client);
  const args = { p_client_name: 'Ana', p_service_name: 'Manicure',
    p_starts_at: nextMondayAt('14:00'), p_ends_at: nextMondayAt('15:00') };
  const results = await Promise.all(Array.from({ length: 10 }, () => client.rpc('create_appointment', args)));
  expect(results.filter(r => !r.error)).toHaveLength(1);
  expect(results.filter(r => r.error?.code === 'AE001')).toHaveLength(9);
});
```

  Mais um caso: duas **remarcações** simultâneas de agendamentos diferentes para o mesmo horário livre → exatamente 1 sucesso, a outra `AE001`, e o agendamento que falhou mantém o horário original.
- [ ] **Step 2: Testes de RLS via API** — `rls-api.test.ts`:
  - Cliente anônimo: `from('appointments').select()` → erro ou lista vazia sem dados; `rpc('create_appointment', …)` → erro `42501`.
  - B: `from('appointments').select().eq('id', idDeA)` → `[]`; `rpc('cancel_appointment', { p_id: idDeA })` → `AE006`; `from('appointments').update({ client_name: 'X' }).eq('id', idDeA)` → erro de permissão; `from('appointment_history').delete()` → erro de permissão.
  - A: `from('appointments').insert({...})` direto → erro de permissão (escrita só por RPC).
- [ ] **Step 3:** `npm run db:reset && npm run test:integration` → FAIL antes de `helpers.ts`/dependência existirem; implementar helpers e config.
- [ ] **Step 4:** `npm run test:integration` → PASS (rodar 3 vezes seguidas para confirmar que a concorrência não é intermitente).
- [ ] **Step 5:** `npm run db:types` gera `src/types/database.ts`; `npm run typecheck` passa.
- [ ] **Step 6:** `docs/banco-de-dados.md`: diagrama/tabela das entidades, regra de cada constraint (mapeada para RN01–RN20), tabela de transições de status, códigos de erro AE001–AE006, privilégios por papel, como rodar `db:test` e `test:integration`. README atualizado com os comandos.
- [ ] **Step 7:** Verificação final: `npm run typecheck && npm run lint && npm test && npm run db:test && npm run test:integration` → tudo PASS.
- [ ] **Step 8: Commit** — `git commit -m "test(db): RLS e concorrência via API, tipos gerados e documentação do banco"`.
