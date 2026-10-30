# Plano 02 — Interface (frontend) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir toda a interface do Agenda em Ordem (React) sobre o banco do Plano 01, fiel às 14 telas aprovadas no estilo Painel em Blocos, para celular e computador.

**Architecture:** SPA React 19 + Vite, Tailwind v4 com tokens da marca, componentes shadcn/ui (Radix). Dados via `@supabase/supabase-js` + TanStack Query; agendamentos e expediente só são escritos por RPC (contrato em `docs/banco-de-dados.md`); perfil e favoritos por update de tabela com RLS. Regras de horário puras e testadas em `src/features/*/domain`, com o **fuso do perfil** como fonte de verdade. Calendário (dia/semana/mês/lista) em componentes próprios.

**Tech Stack:** React 19, Vite 8, TypeScript 6.0 strict, Tailwind CSS v4 (`@tailwindcss/vite`), shadcn/ui + Radix, lucide-react, sonner, vaul (drawer do shadcn), react-router v7 (pacote `react-router`), @tanstack/react-query v5, react-hook-form v7 + zod v4 + @hookform/resolvers, date-fns v4 + @date-fns/tz, @fontsource-variable/inter e /manrope, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-29-agenda-em-ordem-design.md` (aprovado) + `docs/superpowers/specs/2026-10-29-agenda-em-ordem-requisitos.md` + contrato do banco `docs/banco-de-dados.md`. Referência visual: página "Telas — Painel em Blocos" do canvas https://claude.ai/artifact/WF88ue3z7mitG9XeqGyvjz (artboards T01–T14) e "3 · Painel em Blocos" (dashboard). O executor do plano deve abrir o canvas e copiar medidas, cores e textos das telas.

**Branch:** criar `feat/plano-02-interface` a partir de `feat/plano-01-fundacao-banco` (o Plano 01 ainda não foi para a `master`).

**Fora deste plano:** service worker/PWA, Web Push e tela de ativação de notificações neste aparelho, APK (Plano 03); exclusão de conta, CAPTCHA, deploy (Plano 04). Nada disso aparece na interface como botão falso.

## Global Constraints

- Textos em português do Brasil; datas `DD/MM/AAAA`; relógio de 24 h.
- Fuso do perfil (`profiles.timezone`, padrão `America/Sao_Paulo`) é a fonte de verdade de toda conversão; o fuso do navegador nunca decide datas/horários exibidos ou enviados.
- Instantes enviados ao banco como ISO 8601 **com offset** gerados a partir de data+hora locais no fuso do perfil.
- Paleta: azul-marinho `#0F2D5B`, azul `#3B82F6`, azul suave `#E7F1FF`, branco `#FFFFFF`, texto secundário `#64748B`, bordas `#E2E8F0`, fundo `#F8FAFC`. **Botões primários com texto branco usam `#2563EB`** (contraste); `#3B82F6` só em ícones/destaques/elementos grandes.
- Status sempre com ícone + texto + cor: Agendado (azul `#1D4ED8` sobre `#E7F1FF`, relógio), Concluído (`#166534` sobre `#DCFCE7`, check), Não compareceu (`#92400E` sobre `#FEF3C7`, pessoa-x), Cancelado (`#475569` sobre `#F1F5F9`, x, nome riscado).
- Tipografia: Manrope (títulos) e Inter (texto), auto-hospedadas via @fontsource (sem Google Fonts em produção).
- Layout: `≥1024px` = barra lateral de ícones (96 px) + conteúdo; `<1024px` = navegação inferior com 4 destinos (Início, Agenda, Histórico, Ajustes) e botão central circular "+" (`#2563EB`).
- Alvos de toque ≥ 44 px; campos de formulário com fonte ≥ 16 px no celular (evita zoom do iOS); tudo operável por teclado; foco visível.
- Somente `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` no frontend; nenhum segredo, nenhuma chave em arquivo versionado.
- Nenhum analytics/rastreamento; nenhum dado de cliente em `localStorage`/`sessionStorage` (só a sessão do Supabase Auth).
- Erros: mapear pelo contrato (AE001–AE006, 42501, 23514/23502 → "dados inválidos"); **nunca** exibir `details`/`hint` do Postgres.
- Falha de rede nunca vira "salvo" (RN17); formulário mantém o que foi digitado (em memória) e oferece "Tentar novamente".
- Sem funcionalidade falsa: telas/ações só aparecem quando funcionam de verdade.
- Ruling R-UI1 (Claude): o calendário usa componentes próprios em vez de FullCalendar — o requisito permite "solução equivalente"; as telas aprovadas (cartões no celular, grade em blocos) não correspondem ao visual do FullCalendar e evitamos uma dependência grande.

## Review Focus

1. Computador/celular com fuso diferente do perfil (ex.: navegador em `Europe/Lisbon`, perfil `America/Sao_Paulo`): a agenda mostra e grava horários de São Paulo → testes nas Tasks 2 e 11.
2. Internet cai durante "Salvar": nenhuma mensagem de sucesso, campos preservados, "Tentar novamente"; se a 1ª tentativa tinha gravado, o retry que recebe AE001 reconhece o próprio agendamento e não acusa "ocupado" (RN17) → testes nas Tasks 6 e 8.
3. Duplo clique / Enter repetido em "Salvar" ou "Confirmar": exatamente uma chamada → teste na Task 8 (e Task 10).
4. Nome com 120 caracteres, emoji ou `<script>`: aparece literalmente, cortado com reticências, sem quebrar layout → teste na Task 11.
5. Sessão expirada durante uma ação (`42501`/401): volta para "Entrar" com aviso "Sua sessão expirou", sem erro genérico → teste na Task 4.

## Estrutura de arquivos

```
src/
  main.tsx, App.tsx                         # providers + router
  styles/index.css                          # Tailwind v4 + @theme tokens + fontes
  components/ui/                            # shadcn (button, input, label, dialog, drawer, select, switch, tabs, textarea, sonner…)
  components/brand/Logo.tsx                 # SVG da marca (variantes)
  components/status/StatusBadge.tsx
  components/layout/AppShell.tsx, SideRail.tsx, BottomNav.tsx, OfflineBanner.tsx, ResponsiveSheet.tsx
  components/feedback/EmptyState.tsx, ErrorState.tsx, LoadingState.tsx
  lib/env.ts, supabase.ts, errors.ts, time.ts, csv.ts, useMediaQuery.ts, useOnlineStatus.ts
  features/auth/  AuthProvider.tsx, RequireAuth.tsx, pages/{Login,Signup,ForgotPassword,ResetPassword}.tsx
  features/profile/ api.ts
  features/business-hours/ api.ts, domain/defaultHours.ts, pages/FirstAccessPage.tsx, components/HoursEditor.tsx
  features/favorites/ api.ts
  features/appointments/ api.ts, keys.ts, domain/{schema.ts,freeSlots.ts,status.ts}, components/{AppointmentForm.tsx,AppointmentSheet.tsx,ConflictPanel.tsx,StatusActions.tsx,HistoryList.tsx}, pages/ReschedulePage.tsx
  features/calendar/ pages/AgendaPage.tsx, views/{DayView,ListView,WeekView,MonthView}.tsx, components/{AgendaToolbar,ViewSwitcher,StatusFilter,NowLine}.tsx, useAgendaParams.ts
  features/dashboard/ DashboardPage.tsx, domain/indicators.ts
  features/history/ HistoryPage.tsx, useHistorySearch.ts, exportCsv.ts
  features/settings/ SettingsPage.tsx, sections/{Profile,Hours,AgendaPrefs,Favorites,Notifications,Account}Section.tsx
  pages/NotFoundPage.tsx
  test/fakeSupabase.ts, test/render.tsx
tests/e2e/ *.spec.ts, global-setup.ts
playwright.config.ts
public/favicon.svg (marca), public/logo-*.svg
```

---

### Task 1: Design system — Tailwind v4, tokens, fontes, shadcn, marca e StatusBadge

**Files:**
- Create: `src/styles/index.css`, `components.json`, `src/components/ui/*` (via CLI shadcn: button, input, label, textarea, select, switch, tabs, dialog, drawer, sonner), `src/components/brand/Logo.tsx`, `src/components/status/StatusBadge.tsx`, `src/lib/utils.ts` (cn), `public/favicon.svg`, `public/logo-claro.svg`, `public/logo-escuro.svg`, `public/logo-mono.svg`
- Modify: `vite.config.ts`, `vitest.config.ts` (alias `@` → `src`), `tsconfig.app.json` (paths), `src/main.tsx`, `index.html` (favicon, `theme-color` `#0F2D5B`)
- Test: `src/components/status/StatusBadge.test.tsx`, `src/components/brand/Logo.test.tsx`

**Interfaces:**
- Produces: alias `@/…`; Tailwind tokens `--color-navy:#0F2D5B`, `--color-brand:#3B82F6`, `--color-brand-strong:#2563EB`, `--color-soft:#E7F1FF`, `--color-muted:#64748B`, `--color-line:#E2E8F0`, `--color-canvas:#F8FAFC`, fontes `--font-display` (Manrope Variable), `--font-sans` (Inter Variable); raios `--radius-card: 18px`.
- `type AppointmentStatus = Database['public']['Enums']['appointment_status']` exportado de `src/features/appointments/domain/status.ts` junto com `statusMeta: Record<AppointmentStatus, { label: string; icon: LucideIcon; className: string }>` — labels: `agendado`→"Agendado", `concluido`→"Concluído", `nao_compareceu`→"Não compareceu", `cancelado`→"Cancelado".
- `<StatusBadge status={AppointmentStatus} compact?: boolean />` (compact mostra "Faltou" para `nao_compareceu`).
- `<Logo variant: 'icon' | 'full' | 'full-dark' | 'mono' size?: number />` — SVG do calendário com blocos + check (copiar do canvas, artboard D3); `role="img"` + `aria-label="Agenda em Ordem"`.

- [ ] **Step 1: Testes que falham**

```tsx
it.each([
  ['agendado', 'Agendado'], ['concluido', 'Concluído'],
  ['nao_compareceu', 'Não compareceu'], ['cancelado', 'Cancelado'],
] as const)('StatusBadge %s mostra texto e ícone', (status, label) => {
  render(<StatusBadge status={status} />);
  expect(screen.getByText(label)).toBeInTheDocument();
  expect(screen.getByText(label).parentElement?.querySelector('svg')).not.toBeNull();
});
it('StatusBadge compacto de falta mostra "Faltou"', () => { /* status nao_compareceu compact → "Faltou" */ });
it('Logo tem nome acessível', () => {
  render(<Logo variant="full" />);
  expect(screen.getByRole('img', { name: 'Agenda em Ordem' })).toBeInTheDocument();
});
```

- [ ] **Step 2:** `npm test` → FAIL (módulos inexistentes).
- [ ] **Step 3:** Instalar Tailwind v4 (`tailwindcss`, `@tailwindcss/vite`), fontes @fontsource-variable, `lucide-react`; rodar `npx shadcn@latest init` (estilo padrão, base neutra, CSS variables) e `add` dos componentes listados; definir tokens em `@theme` de `index.css` mapeando também as variáveis do shadcn (`--primary` = `#2563EB`, `--ring` = `#3B82F6`, `--radius` = `0.75rem`). Implementar `statusMeta`, `StatusBadge`, `Logo`; trocar o favicon do Vite pelo ícone da marca; gerar as 4 variantes SVG do logo em `public/`.
- [ ] **Step 4:** `npm test && npm run typecheck && npm run lint && npm run build` → PASS.
- [ ] **Step 5: Commit** — `feat(ui): design system com tokens da marca, fontes, shadcn e StatusBadge`

### Task 2: Bibliotecas centrais — env, cliente Supabase, erros e tempo/fuso

**Files:**
- Create: `src/lib/env.ts`, `src/lib/supabase.ts`, `src/lib/errors.ts`, `src/lib/time.ts`
- Test: `src/lib/errors.test.ts`, `src/lib/time.test.ts`, `src/lib/env.test.ts`

**Interfaces:**
- `parseEnv(raw: Record<string, string | undefined>): { supabaseUrl: string; supabasePublishableKey: string }` (zod; lança `Error('Configuração ausente: VITE_SUPABASE_URL')` etc.) e `env` = `parseEnv(import.meta.env)`.
- `supabase: SupabaseClient<Database>` (persistSession true, autoRefreshToken true).
- `type AppErrorKind = 'conflito' | 'fora_expediente' | 'meia_noite' | 'passado' | 'transicao' | 'nao_encontrado' | 'sessao' | 'dados_invalidos' | 'rede' | 'desconhecido'`
- `toAppError(err: unknown): { kind: AppErrorKind; message: string }` — mensagens exatas:
  - AE001 → `conflito`, "Esse horário já está ocupado. Escolha outro horário."
  - AE002 → `fora_expediente`, "Esse horário está fora do seu expediente."
  - AE003 → `meia_noite`, "O atendimento precisa começar e terminar no mesmo dia."
  - AE004 → `passado`, "Esse horário já passou. Confirme se é um registro de atendimento antigo."
  - AE005 → `transicao`, "Essa ação não é permitida para o status atual."
  - AE006 → `nao_encontrado`, "Atendimento não encontrado."
  - 42501, PGRST301, status 401 → `sessao`, "Sua sessão expirou. Entre novamente."
  - 23514, 23502, 22023, 22P02 → `dados_invalidos`, "Alguns dados estão inválidos. Revise os campos."
  - `TypeError` de fetch / `navigator.onLine === false` / mensagem contendo "Failed to fetch" → `rede`, "Sem conexão. Nada foi salvo — tente novamente."
  - resto → `desconhecido`, "Algo deu errado. Tente novamente."
- `time.ts` (todas recebem `tz: string`):
  - `localToInstant(date: string /*YYYY-MM-DD*/, time: string /*HH:mm*/, tz): string` → ISO com offset (ex.: `('2026-11-02','14:00','America/Sao_Paulo')` → `'2026-11-02T14:00:00-03:00'`).
  - `instantToLocal(iso: string, tz): { date: string; time: string; weekday: number /*0=dom*/ }`
  - `formatDateBR(iso | date, tz): string` → `"29/10/2026"`; `formatTime(iso, tz)` → `"14:00"`; `formatLongDate(iso, tz)` → `"Quinta-feira, 29 de outubro"`.
  - `addMinutesToTime(time: string, minutes: number): string | null` (null se passar de `23:59` → mesmo-dia, RN12).
  - `todayInTz(tz, now?: Date): string`; `weekDays(date: string, weekStartsOn: 0|1): string[]` (7 datas); `monthMatrix(date: string, weekStartsOn: 0|1): string[][]` (semanas × 7).
  - Usar `@date-fns/tz` (`TZDate`) + `date-fns`; nunca `new Date(y,m,d)` sem fuso.

- [ ] **Step 1: Testes que falham** — `time.test.ts`:
  - `localToInstant('2026-11-02','14:00','America/Sao_Paulo')` === `'2026-11-02T14:00:00-03:00'`; com `'America/Manaus'` → `'-04:00'`.
  - **Review Focus 1:** com `process.env.TZ = 'Europe/Lisbon'` (setar em `vitest` via `vi.stubEnv` não altera o fuso do Node — usar teste que passe um `now` fixo e verifique `instantToLocal('2026-11-02T17:00:00Z','America/Sao_Paulo').time === '14:00'` e `todayInTz('America/Sao_Paulo', new Date('2026-10-30T02:30:00Z')) === '2026-10-29'`).
  - `addMinutesToTime('23:30', 45)` === null; `addMinutesToTime('13:00', 45)` === `'13:45'`.
  - `weekDays('2026-10-29', 1)[0]` === `'2026-10-26'`; com `0` → `'2026-10-25'`.
  - `monthMatrix('2026-10-15', 1)` tem 5 semanas, primeira começa `'2026-09-28'`.
  - `formatLongDate('2026-10-29T17:00:00Z','America/Sao_Paulo')` === `'Quinta-feira, 29 de outubro'`.
  - `errors.test.ts`: tabela `it.each` com `{code:'AE001'}`→`conflito` … e `new TypeError('Failed to fetch')`→`rede`; garantir que a mensagem nunca contém `details` (passar `{code:'23514', details:'Failing row contains (secret)'}` e afirmar que `message` não contém `secret`).
  - `env.test.ts`: `parseEnv({})` lança com "VITE_SUPABASE_URL".
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Instalar `date-fns`, `@date-fns/tz`, `zod`; implementar.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** — `feat(lib): cliente supabase, mapeamento de erros e utilitários de fuso`

### Task 3: Domínio de agendamentos — schema do formulário e horários livres

**Files:**
- Create: `src/features/appointments/domain/schema.ts`, `src/features/appointments/domain/freeSlots.ts`, `src/features/business-hours/domain/defaultHours.ts`
- Test: `…/schema.test.ts`, `…/freeSlots.test.ts`

**Interfaces:**
- `appointmentFormSchema` (zod) → `AppointmentFormValues = { clientName: string; clientPhone: string; serviceName: string; date: string; startTime: string; durationMinutes: number; notes: string; confirmPast: boolean }` com regras espelhando o banco: nome/serviço `trim` 1–120; telefone vazio ou 8–20 chars `^[0-9()+ -]+$`; notas ≤1000; `date` `YYYY-MM-DD` válido; `startTime` `HH:mm`; duração inteira 5–720; fim no mesmo dia (`addMinutesToTime` ≠ null) — mensagens pt-BR ("Informe o nome do cliente", "Telefone inválido", "O atendimento precisa terminar no mesmo dia").
- `type Shift = { weekday: number; start_time: string; end_time: string }`; `type BusyInterval = { startsAt: string; endsAt: string }` (instantes).
- `freeIntervals(date: string, tz: string, shifts: Shift[], busy: BusyInterval[], now: Date): Array<{ start: string; end: string }>` — horários `HH:mm` livres do dia: turnos do weekday menos ocupados (ignorar cancelados antes de chamar), cortando o passado se `date` for hoje (arredondar `now` para cima no próximo múltiplo de 5 min).
- `slotStarts(free: Array<{start;end}>, durationMinutes: number, stepMinutes: 15|30|60): string[]` — inícios onde cabe a duração.
- `isWithinShifts(date, tz, shifts, startTime, durationMinutes): boolean`.
- `DEFAULT_SHIFTS: Shift[]` = seg–sex (1..5) `09:00–12:00` e `13:00–18:00`.

- [ ] **Step 1: Testes que falham** — `freeSlots.test.ts`:
  - dia 2026-10-29 (qui=4), fuso São Paulo, turnos 08:00–12:00/13:00–19:00, ocupados 08:30–09:30, 10:00–11:00, 11:30–12:00, 14:00–15:00, 15:00–16:00, 17:00–18:00, `now` = 2026-10-28T12:00-03:00 (véspera) → `[{08:00–08:30},{09:30–10:00},{11:00–11:30},{13:00–14:00},{16:00–17:00},{18:00–19:00}]`.
  - adjacência não cria lacuna (14–15 e 15–16 → nada entre).
  - `slotStarts([{start:'13:00',end:'14:00'}], 45, 15)` → `['13:00','13:15']`.
  - domingo sem turno → `[]`.
  - hoje com now 13:41 → primeiro livre começa `'13:45'`.
  - `schema.test.ts`: `'   '` em nome → erro "Informe o nome do cliente"; telefone `'abc12345'` → "Telefone inválido"; `startTime '23:30'` + 45 min → "O atendimento precisa terminar no mesmo dia"; caso válido passa e devolve nome aparado.
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(domain): validação do agendamento e cálculo de horários livres`

### Task 4: Casca do app — providers, rotas, autenticação protegida, layout responsivo e conexão

**Files:**
- Create: `src/App.tsx` (substitui o atual), `src/features/auth/AuthProvider.tsx`, `src/features/auth/RequireAuth.tsx`, `src/components/layout/{AppShell,SideRail,BottomNav,OfflineBanner,ResponsiveSheet}.tsx`, `src/components/feedback/{EmptyState,ErrorState,LoadingState}.tsx`, `src/lib/useMediaQuery.ts`, `src/lib/useOnlineStatus.ts`, `src/pages/NotFoundPage.tsx`, `src/test/render.tsx`, `src/test/fakeSupabase.ts`
- Modify: `src/App.test.tsx`
- Test: `src/components/layout/AppShell.test.tsx`, `src/features/auth/RequireAuth.test.tsx`, `src/pages/NotFoundPage.test.tsx`

**Interfaces:**
- Rotas (react-router v7, `createBrowserRouter`): públicas `/entrar`, `/cadastro`, `/recuperar-senha`, `/redefinir-senha`; protegidas (dentro de `RequireAuth` + `AppShell`) `/` (Início), `/agenda`, `/agenda/remarcar/:id`, `/historico`, `/ajustes/:secao?`; `/primeiro-acesso` (protegida, sem shell); `*` → `NotFoundPage`.
- `useAuth(): { session: Session | null; user: User | null; loading: boolean; signOut(): Promise<void> }`.
- `RequireAuth`: sem sessão → `<Navigate to="/entrar" state={{ from, reason?: 'sessao' }} />`; com sessão e **sem turnos de expediente** → `/primeiro-acesso` (usa `useBusinessHours` da Task 6 — nesta task, ler via prop/injeção: `RequireAuth({ hasBusinessHours?: boolean })` fica testável; a ligação real com o hook entra na Task 7).
- `QueryClient` global com `onError` que, para `kind === 'sessao'`, chama `signOut()` e navega para `/entrar` com `state.reason = 'sessao'` (**Review Focus 5**).
- `AppShell`: `useMediaQuery('(min-width: 1024px)')` → `SideRail` (96 px, ícones+rótulos, "+" no topo, avatar) ou `BottomNav` (Início, Agenda, "+", Histórico, Ajustes) — classes/medidas das telas T01/T03. O "+" abre o formulário de novo agendamento via `useNewAppointment().open()` (contexto criado aqui; o formulário entra na Task 8).
- `ResponsiveSheet({ open, onOpenChange, title, children, footer })`: `Drawer` (vaul) abaixo de 1024 px, `Dialog` acima; foco preso e `Esc` fecha.
- `OfflineBanner`: quando `useOnlineStatus()` é false, faixa fixa "Sem conexão. Você pode ver a agenda, mas nada será salvo até a internet voltar." com `role="status"`.
- `test/render.tsx`: `renderWithProviders(ui, { route?, session?, supabase? })`; `test/fakeSupabase.ts`: `createFakeSupabase({ rpc?: Record<string, (args) => {data?, error?}>, tables?: Record<string, Row[]>, session? })` com API mínima usada (`rpc`, `from().select().eq().gte().lt().order()`, `from().update().eq()`, `from().insert()`, `from().delete().eq()`, `auth.getSession`, `auth.onAuthStateChange`, `auth.signInWithPassword`, `auth.signUp`, `auth.resetPasswordForEmail`, `auth.updateUser`, `auth.signOut`).

- [ ] **Step 1: Testes que falham**
  - `AppShell.test.tsx`: com `matchMedia` ≥1024 → `getByRole('navigation', {name:'Navegação principal'})` contém links "Início","Agenda","Histórico","Ajustes" e botão "Novo agendamento"; com <1024 → mesma navegação na parte inferior (testar presença de `BottomNav` por `data-testid="bottom-nav"`).
  - `RequireAuth.test.tsx`: sem sessão → rota `/entrar` renderizada; com sessão e `hasBusinessHours=false` → `/primeiro-acesso`; **Review Focus 5:** disparar `toAppError({code:'42501'})` via `queryClient` → tela "Entrar" mostra "Sua sessão expirou. Entre novamente."
  - `NotFoundPage.test.tsx`: título "Página não encontrada" e links "Ir para o início" (`/`) e "Abrir agenda" (`/agenda`).
  - `OfflineBanner`: `window.dispatchEvent(new Event('offline'))` → texto aparece; `online` → some.
- [ ] **Step 2:** FAIL. **Step 3:** instalar `react-router`, `@tanstack/react-query`; implementar. **Step 4:** `npm test && npm run typecheck && npm run lint` PASS.
- [ ] **Step 5: Commit** — `feat(app): rotas, sessão protegida, layout responsivo e aviso de conexão`

### Task 5: Telas de autenticação

**Files:**
- Create: `src/features/auth/pages/{LoginPage,SignupPage,ForgotPasswordPage,ResetPasswordPage}.tsx`, `src/features/auth/AuthLayout.tsx`
- Test: `src/features/auth/pages/*.test.tsx`

**Interfaces:**
- Layout = tela T14 (painel azul-marinho com logo, slogan "Tudo organizado em um só lugar." e 3 benefícios; formulário à direita; empilha abaixo de 1024 px com o painel reduzido a logo + slogan).
- Login: e-mail, senha (mostrar/ocultar), "Esqueci minha senha", "Entrar", "Ainda não tem conta? Criar conta". Após login → `state.from` ou `/`.
- Cadastro: nome (vai em `options.data.display_name`, 1–80 após trim), e-mail, senha (mín. 8), confirmar senha. Se o Supabase exigir confirmação (sessão nula após signUp) → mensagem "Enviamos um link de confirmação para {email}."
- Recuperar: e-mail → `resetPasswordForEmail(email, { redirectTo: origin + '/redefinir-senha' })` → sempre "Se houver uma conta com esse e-mail, você vai receber um link." (não revela existência).
- Redefinir: nova senha + confirmar → `updateUser({ password })` → toast "Senha alterada" → `/`.
- Mensagens de erro do Auth mapeadas: credenciais inválidas → "E-mail ou senha incorretos."; e-mail já usado → "Já existe uma conta com esse e-mail."; senha fraca → "A senha precisa ter pelo menos 8 caracteres."; limite de tentativas (429) → "Muitas tentativas. Aguarde alguns minutos."

- [ ] **Step 1: Testes que falham** (com `fakeSupabase`): login com erro `invalid_credentials` mostra "E-mail ou senha incorretos." e mantém o e-mail digitado; botão "Entrar" fica `disabled` enquanto envia (um único `signInWithPassword` em dois cliques); cadastro envia `display_name` aparado; recuperar mostra a mesma mensagem para qualquer e-mail; campos com `<label>` associados (`getByLabelText('E-mail')`).
- [ ] **Step 2:** FAIL. **Step 3:** instalar `react-hook-form`, `@hookform/resolvers`; implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(auth): entrar, criar conta e recuperar senha`

### Task 6: Camada de dados — consultas e mutações (TanStack Query)

**Files:**
- Create: `src/features/appointments/keys.ts`, `src/features/appointments/api.ts`, `src/features/profile/api.ts`, `src/features/business-hours/api.ts`, `src/features/favorites/api.ts`
- Test: `src/features/appointments/api.test.tsx`, `src/features/profile/api.test.tsx`, `src/features/favorites/api.test.tsx`

**Interfaces:**
- `type Appointment = Database['public']['Tables']['appointments']['Row']`; `type HistoryEntry = …['appointment_history']['Row']`; `type Profile`, `type FavoriteService`.
- Chaves: `apptKeys.range(fromIso, toIso)`, `apptKeys.detail(id)`, `apptKeys.history(id)`, `apptKeys.search(params)`.
- Consultas: `useAppointmentsRange(fromIso: string, toIso: string)` (`starts_at >= from` e `< to`, ordenado por `starts_at`); `useAppointment(id)`; `useAppointmentHistory(id)` (ordenado por `created_at desc`); `useProfile()`; `useBusinessHours()` (ordenado por weekday, start_time); `useFavorites(includeInactive?: boolean)`.
- Mutações (todas invalidam `apptKeys.all` no sucesso e devolvem `AppError` via `toAppError` no erro): `useCreateAppointment()` → input `{ clientName, clientPhone, serviceName, startsAt, endsAt, notes, confirmPast }`; `useRescheduleAppointment()` `{ id, startsAt, endsAt, confirmPast }`; `useUpdateDetails()` `{ id, clientName, serviceName, clientPhone, notes }` (sempre os 5 — substituição total); `useSetStatus()` `{ id, status }`; `useCancelAppointment()` `{ id, reason }`; `useReactivateAppointment()` `{ id }`; `useUpdateProfile()` (colunas de preferência); `useSetBusinessHours()` `(shifts: Shift[])`; `useSaveFavorite()` / `useDeleteFavorite()`.
- **RN17 (Review Focus 2):** `useCreateAppointment` — se a chamada falhar com `rede`, o erro é exibido e nada é marcado como salvo. Se uma nova tentativa do mesmo input receber `conflito`, antes de mostrar o erro consultar `appointments` com `starts_at = startsAt`, `ends_at = endsAt`, `client_name = clientName`, status ≠ cancelado, criado nos últimos 2 min; se existir, tratar como sucesso (`reconciled: true`). Implementar como `createWithReconcile(input, attempt: number)`.

- [ ] **Step 1: Testes que falham** (fakeSupabase + `renderHook`):
  - create chama `rpc('create_appointment', { p_client_name, p_service_name, p_starts_at, p_ends_at, p_client_phone: null quando '' , p_notes: null quando '', p_confirm_past })`.
  - create com `{code:'AE001'}` → `error.kind === 'conflito'`.
  - **RN17:** 1ª tentativa `TypeError('Failed to fetch')` → `kind 'rede'`; 2ª tentativa recebe AE001 mas a tabela fake contém o agendamento recém-criado igual → resultado de sucesso com `reconciled: true`; se não contiver → `conflito`.
  - updateDetails envia sempre `p_client_phone` e `p_notes` (mesmo vazios → null).
  - `useAppointmentsRange` filtra pelo intervalo (verificar argumentos `gte`/`lt` no fake).
  - favoritos: salvar não envia `owner_id`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(data): consultas e mutações com mapeamento de erros e reconciliação RN17`

### Task 7: Primeiro acesso — "Quando você atende?"

**Files:**
- Create: `src/features/business-hours/components/HoursEditor.tsx`, `src/features/business-hours/pages/FirstAccessPage.tsx`
- Modify: `src/features/auth/RequireAuth.tsx` (liga `useBusinessHours`: lista vazia → `/primeiro-acesso`)
- Test: `HoursEditor.test.tsx`, `FirstAccessPage.test.tsx`

**Interfaces:**
- `HoursEditor({ value: Shift[]; onChange(shifts: Shift[]): void; variant: 'compact' | 'full' })` — `compact` = tela T12 (linha por dia, toque abre edição do dia); `full` = tela T11 (switch por dia, turnos editáveis com início/fim, "+ Turno", remover, domingo "Fechado"). Validação local: fim > início, turnos do mesmo dia sem sobreposição, máx. 21 turnos; mensagens "O fim precisa ser depois do início" / "Turnos não podem se sobrepor".
- `FirstAccessPage`: inicia com `DEFAULT_SHIFTS`; "Confirmar e começar" → `useSetBusinessHours` → `/`.

- [ ] **Step 1: Testes que falham:** página inicia com Seg–Sex "09:00–12:00 · 13:00–18:00" e Sáb/Dom "Fechado"; confirmar chama `set_business_hours` com 10 turnos; editor `full` recusa 11:00–14:00 sobrepondo 09:00–12:00 com a mensagem; `RequireAuth` com `business_hours` vazio leva a `/primeiro-acesso` e com turnos leva ao Início.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(onboarding): primeiro acesso com expediente pré-preenchido`

### Task 8: Formulário de novo agendamento / edição

**Files:**
- Create: `src/features/appointments/components/{AppointmentForm,ConflictPanel,NewAppointmentProvider}.tsx`
- Test: `AppointmentForm.test.tsx`

**Interfaces:**
- `NewAppointmentProvider` + `useNewAppointment(): { open(prefill?: { date?: string; startTime?: string }): void }` (usado pelo "+" e pelos horários livres).
- `AppointmentForm({ mode: 'create' | 'edit'; appointment?: Appointment; prefill?; onDone(): void })` dentro de `ResponsiveSheet` — telas T05 (celular) e T08 (computador). Campos: Nome do cliente, Telefone (opcional, `inputMode="tel"`), Serviço (chips dos favoritos ativos com duração; escolher um preenche serviço e duração; "Outro" libera texto), Data (padrão hoje no fuso do perfil), Início, Duração (padrão `profiles.default_duration_minutes`), "Termina às" calculado, Observações.
- Estado de disponibilidade (antes de salvar, calculado no cliente com `freeIntervals`/`isWithinShifts`): verde "Horário livre, dentro do expediente"; âmbar "Fora do seu expediente"; vermelho com `ConflictPanel` listando quem conflita e até 3 horários livres sugeridos do mesmo dia (clicar preenche o início). O servidor continua sendo a palavra final: erro `conflito` do RPC também abre o `ConflictPanel` (RN18).
- Horário no passado (RN13): checkbox "Este é um registro de atendimento que já aconteceu" aparece só quando o início é passado; sem marcar, "Salvar" fica desabilitado com a explicação.
- Modo `edit`: só nome, telefone, serviço e observações (data/hora ficam na remarcação); chama `useUpdateDetails` com os 5 campos.
- Envio: botão desabilitado e com "Salvando…" durante a mutação (**Review Focus 3**); sucesso → toast "Agendamento salvo" e fecha; `rede` → mantém tudo, mensagem do `toAppError` + botão "Tentar novamente" (**Review Focus 2**).

- [ ] **Step 1: Testes que falham:**
  - escolher favorito "Manicure 45 min" com início 13:00 mostra "Termina às 13:45".
  - início que conflita com agendamento existente mostra "Esse horário já está ocupado" e sugestões; clicar na sugestão "16:00" preenche o início.
  - RPC devolve AE001 → `ConflictPanel` aparece e os campos continuam preenchidos.
  - **Review Focus 3:** dois cliques rápidos em "Salvar agendamento" → `rpc` chamado 1 vez.
  - **Review Focus 2:** RPC rejeita com `TypeError('Failed to fetch')` → nenhum toast de sucesso, texto "Sem conexão. Nada foi salvo — tente novamente.", valores preservados, "Tentar novamente" reenvia o mesmo input.
  - início no passado sem marcar a confirmação → botão desabilitado; marcando → envia `p_confirm_past: true`.
  - modo edit envia `update_appointment_details` com os 5 parâmetros.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(agendamento): formulário com disponibilidade, conflito e reenvio seguro`

### Task 9: Detalhes do atendimento, ações de status e histórico

**Files:**
- Create: `src/features/appointments/components/{AppointmentSheet,StatusActions,HistoryList,CancelDialog}.tsx`
- Test: `AppointmentSheet.test.tsx`, `StatusActions.test.tsx`

**Interfaces:**
- Abertura por parâmetro de URL `?atendimento=<id>` em qualquer página protegida (link compartilhável e botão Voltar do celular fecha). `AppointmentSheet` = tela T06.
- `StatusActions({ appointment })` mostra exatamente as ações permitidas pela tabela do design §6.1:
  - `agendado`: Remarcar (→ `/agenda/remarcar/:id`), Concluir, Não compareceu, Editar dados, Cancelar atendimento.
  - `concluido`: Marcar como não compareceu, Voltar para agendado, Editar dados.
  - `nao_compareceu`: Marcar como concluído, Voltar para agendado, Editar dados.
  - `cancelado`: Reativar.
- Confirmações (diálogo) para Cancelar (com motivo opcional, até 300 caracteres), Não compareceu e Reativar. Reativar com `conflito` → mensagem + atalho "Remarcar".
- `HistoryList({ entries })`: rótulos `criado`→"Agendamento criado", `editado`→"Dados editados", `remarcado`→"Remarcado de {antes} para {depois}", `status_alterado`→"Status: {antes} → {depois}", `cancelado`→"Cancelado" (+ "Motivo: …"), `reativado`→"Reativado"; datas no fuso do perfil.
- Telefone vira link `tel:`.

- [ ] **Step 1: Testes que falham:** para cada status, `it.each` com os botões esperados e ausência dos demais; Cancelar abre diálogo e envia `cancel_appointment` com motivo aparado; histórico `remarcado` mostra "Remarcado de 28/10 às 15:00 para 29/10 às 14:00" (perfil São Paulo); id inexistente (AE006 / vazio) mostra "Atendimento não encontrado."
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(agendamento): detalhes, ações por status e histórico`

### Task 10: Remarcação

**Files:**
- Create: `src/features/appointments/pages/ReschedulePage.tsx`
- Test: `ReschedulePage.test.tsx`

**Interfaces:**
- Tela T07: cabeçalho com voltar; cartão do atendimento (nome, serviço, duração, horário atual); seletor de dias (próximos 14 dias com expediente, pulando dias sem turnos); grade de horários do dia escolhido com `slotStarts(freeIntervals(...excluindo o próprio agendamento...), duração, profile.slot_interval_minutes)` — ocupados aparecem desabilitados e riscados com "ocupado"; resumo "De → Para"; nota "Nome, telefone, serviço e observações são mantidos."; "Confirmar remarcação" → `useRescheduleAppointment` → toast "Atendimento remarcado" → volta à agenda no novo dia.
- Mantém a duração original. Só permitido para `agendado` (outros status → mensagem e voltar).
- AE001 no servidor → mensagem, recarrega horários, mantém a seleção do dia.

- [ ] **Step 1: Testes que falham:** o próprio horário atual não aparece como ocupado para si mesmo (pode remarcar para sobrepor parcialmente o próprio intervalo); horário ocupado por outro fica desabilitado; confirmar envia `reschedule_appointment` com ISO do novo início/fim no fuso do perfil; duplo clique → 1 chamada; status `concluido` mostra "Só atendimentos agendados podem ser remarcados."
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(agendamento): remarcação com horários livres`

### Task 11: Agenda — Dia (celular) e Lista

**Files:**
- Create: `src/features/calendar/pages/AgendaPage.tsx`, `src/features/calendar/useAgendaParams.ts`, `src/features/calendar/views/{DayView,ListView}.tsx`, `src/features/calendar/components/{AgendaToolbar,ViewSwitcher,StatusFilter,NowLine}.tsx`
- Test: `DayView.test.tsx`, `ListView.test.tsx`, `useAgendaParams.test.ts`

**Interfaces:**
- `useAgendaParams(): { view: 'dia'|'semana'|'mes'|'lista'; date: string; status: AppointmentStatus[] | null; set(partial) }` — estado na URL (`/agenda?visao=dia&data=2026-10-29&status=agendado,concluido`); visão padrão = `profiles.default_view`, mas abaixo de 1024 px "semana"/"mês" continuam disponíveis e o padrão vira "dia".
- `AgendaToolbar`: "Hoje", anterior/próximo (dia, semana ou mês conforme a visão), título de data, `ViewSwitcher` (Dia/Semana/Mês/Lista), `StatusFilter` (Todos, Agendados, Concluídos, Faltas, Cancelados — multi).
- `DayView` (tela T01): resumo "N atendimentos · M horários livres"; já realizados de hoje recolhidos ("3 já realizados (08:30 – 12:00)", expansível); linha do almoço (intervalo entre turnos); horários livres tracejados clicáveis (abre formulário com data/início); cancelado no meio de um livre aparece como "{nome} cancelou"; `NowLine` "Agora · HH:mm" (atualiza a cada minuto); próximo atendimento destacado em azul-marinho com "Próximo". Clique no cartão → `?atendimento=id`.
- `ListView` (tela T02): busca local por cliente/serviço, grupos por dia ("Hoje · qui 29/10", "Amanhã · sex 30/10", depois "Sáb 31/10"), próximos 30 dias a partir da data; vazio → `EmptyState` "Nenhum atendimento por aqui." com botão "Novo agendamento".
- Carregando → `LoadingState` (esqueletos); erro → `ErrorState` com "Tentar novamente".

- [ ] **Step 1: Testes que falham:**
  - DayView com os dados do T01 mostra "7 atendimentos", horário livre "13:00" com "Toque para agendar", Juliana com "Próximo" e linha "Agora · 13:40" (now fixo `2026-10-29T13:40-03:00`).
  - **Review Focus 1:** mesmos dados com fuso do perfil `America/Sao_Paulo` e o teste rodando com `now` em UTC → horários continuam "14:00".
  - **Review Focus 4:** cliente `"<script>alert(1)</script>"` aparece como texto literal; nome de 120 caracteres tem classe `truncate` e `title` com o nome completo.
  - filtro "Cancelados" esconde os demais.
  - `useAgendaParams` lê/escreve `visao`, `data`, `status` na URL.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(agenda): visões dia e lista com horários livres e filtros`

### Task 12: Agenda — Semana e Mês (computador)

**Files:**
- Create: `src/features/calendar/views/{WeekView,MonthView}.tsx`, `src/features/calendar/layout/eventLayout.ts`
- Test: `WeekView.test.tsx`, `MonthView.test.tsx`, `eventLayout.test.ts`

**Interfaces:**
- `layoutDay(events: Array<{ id; start: string /*HH:mm*/; end: string }>, dayStart: string, dayEnd: string, pxPerHour: number): Array<{ id; top: number; height: number }>` — `dayStart`/`dayEnd` = menor início e maior fim dos turnos da semana (fallback 08:00–19:00); 52 px/h; altura mínima 24 px (eventos ≤30 min mostram uma linha).
- `WeekView` (tela T03): colunas dos dias com expediente na semana (`weekDays(date, profile.week_starts_on)`; dias sem turno nenhum somem; dia sem turno mas com atendimento aparece hachurado), cabeçalho com hoje destacado, linhas por hora, faixas hachuradas para almoço e fora do expediente, eventos coloridos por status (cancelados tracejados e riscados), próximo em azul-marinho, `NowLine` na coluna de hoje, clique em área livre dentro do expediente abre formulário com o horário arredondado para `slot_interval_minutes`. **Abaixo de 1024 px** a visão Semana não usa a grade: mostra uma faixa com os 7 dias (número de atendimentos e ponto de "tem livre") e, embaixo, o `DayView` do dia tocado — sem rolagem horizontal (requisito §4).
- `MonthView` (tela T04): `monthMatrix`; até 2 atendimentos por dia + "+N mais" (abre visão Dia daquela data); passados em cinza, futuros em azul suave, cancelados riscados; dias sem expediente "Fechado" hachurado; hoje com borda azul.

- [ ] **Step 1: Testes que falham:** `layoutDay` com 08:00–19:00: evento 14:00–15:00 → `top 312, height 52`; 11:30–12:00 → `height 26`; WeekView com semana de 26/10 mostra 6 colunas (Seg–Sáb) quando domingo não tem turno; clique em 11:00 de sexta abre formulário com `date '2026-10-30'` e `startTime '11:00'`; com `matchMedia` < 1024 px a WeekView renderiza a faixa de 7 dias e, ao tocar "Sex 30", o `DayView` daquele dia (sem elemento com rolagem horizontal); MonthView de out/2026 mostra "+5 mais" no dia 29 com 7 atendimentos e "Fechado" nos domingos.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(agenda): visões semana e mês`

### Task 13: Início (dashboard)

**Files:**
- Create: `src/features/dashboard/DashboardPage.tsx`, `src/features/dashboard/domain/indicators.ts`
- Test: `indicators.test.ts`, `DashboardPage.test.tsx`

**Interfaces:**
- `computeIndicators(appts: Appointment[], tz: string, now: Date, weekStartsOn: 0|1): { today: number; todayRemaining: number; todayNoShows: number; next: Appointment | null; week: number; monthCancellations: number }` — "hoje/semana" contam não cancelados; `next` = primeiro `agendado` com início ≥ now; cancelamentos do mês = status cancelado com `starts_at` no mês corrente (fuso do perfil).
- Tela D3 (celular e computador): saudação por hora local ("Bom dia" até 11:59, "Boa tarde" até 17:59, "Boa noite"), nome do perfil, data longa; cartão azul-marinho "Próximo atendimento" com "em N min"/"às HH:mm"/"amanhã às HH:mm", Ver detalhes e Remarcar; indicadores (Hoje, Semana, Cancelamentos do mês); "Horários livres hoje"; "Próximos atendimentos" (até 5); minicalendário no computador. Sem dados → `EmptyState` "Sua agenda está livre. Que tal marcar o primeiro atendimento?" com "Novo agendamento". Sem gráficos financeiros.

- [ ] **Step 1: Testes que falham:** fixture (fuso São Paulo, `now` = 2026-10-29T13:40-03:00, semana começa segunda): A 29/10 08:30 `concluido`, B 29/10 11:30 `nao_compareceu`, C 29/10 14:00 `agendado`, D 29/10 16:30 `cancelado`, E 29/10 17:00 `agendado`, F 30/10 09:00 `agendado`, G 05/10 10:00 `cancelado`, H 02/11 09:00 `agendado` → `computeIndicators` = `{ today: 4, todayRemaining: 2, todayNoShows: 1, next: C, week: 5, monthCancellations: 2 }`; saudação "Boa tarde" às 13:40; cartão do próximo mostra "em 20 min"; lista vazia mostra o texto do EmptyState.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(inicio): painel com próximo atendimento e indicadores`

### Task 14: Histórico, busca e exportação CSV

**Files:**
- Create: `src/features/history/{HistoryPage,useHistorySearch}.tsx`, `src/lib/csv.ts`, `src/features/history/exportCsv.ts`
- Test: `csv.test.ts`, `HistoryPage.test.tsx`

**Interfaces:**
- `useHistorySearch({ q, statuses, service, from, to, page })` — filtros na URL; consulta `appointments` com `ilike('client_name', '%q%')` (escapar `%` e `_` do termo), `in('status', …)`, `eq('service_name', …)`, intervalo por `starts_at` convertido do fuso do perfil; 25 por página, `order starts_at desc`; destaque do termo no nome (`<mark>`), sem `dangerouslySetInnerHTML`.
- Painel "Remarcações e cancelamentos" = últimas 10 entradas de `appointment_history` com ação `remarcado`/`cancelado`.
- `toCsv(rows: string[][]): string` — separador `;`, BOM UTF-8, aspas duplicadas, e **neutralização de fórmula**: célula iniciando com `=`, `+`, `-`, `@`, tab ou CR recebe `'` na frente.
- `exportAppointmentsCsv(filters)` busca **todas** as páginas do filtro atual (só do usuário, via RLS) e baixa `agenda-em-ordem-AAAA-MM-DD.csv` com colunas: Data, Início, Fim, Cliente, Telefone, Serviço, Status, Observações, Motivo do cancelamento.

- [ ] **Step 1: Testes que falham:** `toCsv([['=1+1','a;b','x"y']])` → `"'=1+1";"a;b";"x""y"` (com BOM); termo `50%_off` vira padrão escapado; HistoryPage com `q=ana` mostra "6 resultados" na fixture e `<mark>` em "Ana"; clicar "Exportar CSV" gera arquivo com cabeçalho exato.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(historico): busca com filtros e exportação CSV segura`

### Task 15: Configurações

**Files:**
- Create: `src/features/settings/SettingsPage.tsx`, `src/features/settings/sections/{ProfileSection,HoursSection,AgendaPrefsSection,FavoritesSection,NotificationsSection,AccountSection}.tsx`
- Test: `SettingsPage.test.tsx`, `FavoritesSection.test.tsx`

**Interfaces:**
- Tela T11: navegação lateral de seções no computador (lista no celular): Perfil, Expediente, Agenda, Serviços favoritos, Notificações, Conta e privacidade (`/ajustes/:secao`).
- Perfil: nome (1–80), estabelecimento (opcional), fuso (select com fusos do Brasil: America/Sao_Paulo, America/Manaus, America/Belem, America/Fortaleza, America/Recife, America/Bahia, America/Cuiaba, America/Campo_Grande, America/Porto_Velho, America/Boa_Vista, America/Rio_Branco, America/Noronha, America/Araguaina, America/Maceio, America/Santarem).
- Expediente: `HoursEditor variant="full"` + "Salvar expediente" (`set_business_hours`); erro `22023` → "Revise os turnos: há horários inválidos ou sobrepostos."
- Agenda: duração padrão (5–480), grade 15/30/60, primeiro dia da semana (domingo/segunda), visão inicial (dia/semana/mês/lista).
- Serviços favoritos: lista com nome, duração, cor opcional (paleta de 6 cores com contraste), ativo/inativo, adicionar/editar/remover (confirmação); nome duplicado (23505) → "Você já tem um serviço com esse nome."
- Notificações: só as preferências gravadas no perfil (antecedência Desligado/15/30/60 e "Ocultar nome do cliente na tela de bloqueio") + texto "A ativação neste aparelho chega na próxima atualização." (sem botão falso; Plano 03 adiciona a ativação).
- Conta e privacidade: alterar senha (`updateUser`, nova senha mín. 8 + confirmação), "Baixar meus dados (CSV)" reutilizando `exportAppointmentsCsv` sem filtros, e "Sair". A política de privacidade e a exclusão de conta ficam para o Plano 04 (não aparecem aqui).

- [ ] **Step 1: Testes que falham:** salvar perfil envia só colunas permitidas (sem `id`); trocar visão inicial para "Lista" grava `default_view: 'lista'`; favorito duplicado mostra a mensagem; seção Notificações não contém botão "Ativar".
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(ajustes): perfil, expediente, preferências, favoritos e conta`

### Task 16: Testes ponta a ponta (Playwright), responsividade e documentação

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/global-setup.ts`, `tests/e2e/{auth,agendamento,conflito,responsivo,conexao}.spec.ts`, `docs/guia-de-testes.md`
- Modify: `package.json` (scripts `e2e`, `e2e:ui`), `README.md`, `.gitignore` (`playwright-report`, `test-results`, `.env.test.local`)

**Interfaces:**
- `global-setup.ts`: lê `npx supabase status -o json` (mesma regra do Plano 01: `PUBLISHABLE_KEY ?? ANON_KEY`), escreve `.env.test.local` (ignorado pelo git) com `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY`; cada teste cria seu usuário com e-mail único via admin API.
- `webServer`: `vite --mode test --port 5174`; projetos Playwright: `chromium-desktop` (1440×900), `webkit-iphone` (iPhone 15, Safari), `chromium-android` (Pixel 7).
- Cenários:
  - `auth`: criar conta → primeiro acesso → confirmar expediente → Início com "Sua agenda está livre"; sair; entrar de novo.
  - `agendamento`: novo agendamento pelo "+" com favorito, aparece na Agenda (dia) e no Início como próximo; abrir detalhes → Concluir → status "Concluído"; editar dados; remarcar para outro dia; cancelar com motivo; reativar.
  - `conflito`: criar 14:00–15:00; tentar 14:30 → painel de conflito; escolher sugestão → salva.
  - `responsivo`: em iPhone a navegação inferior aparece e a barra lateral não; no desktop o inverso; nenhuma página com rolagem horizontal do `body` (`scrollWidth <= clientWidth`) em `/`, `/agenda`, `/historico`, `/ajustes`.
  - `conexao`: `context.setOffline(true)` durante "Salvar" → mensagem "Sem conexão. Nada foi salvo…", campos preservados; `setOffline(false)` + "Tentar novamente" → salvo uma única vez (contar no banco).
- `docs/guia-de-testes.md`: como rodar unit, `db:test`, `test:integration`, `e2e`; pré-requisitos (Docker, `npm run db:start`, `npx playwright install`).

- [ ] **Step 1:** escrever os specs; `npm run e2e` → FAIL onde ainda houver lacuna; corrigir só o que for defeito de integração (comportamentos novos não entram aqui).
- [ ] **Step 2:** `npm run typecheck && npm run lint && npm test && npm run db:test && npm run test:integration && npm run e2e` → tudo PASS (rodar `e2e` 2 vezes para conferir estabilidade).
- [ ] **Step 3: Commit** — `test(e2e): fluxos principais em desktop, iPhone e Android`
