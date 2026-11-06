# Identidade visual Clanix e tema escuro — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a aparência do app inteiro pela identidade Clanix (paleta roxa, Sora + Inter, componentes do manual, logo/ícones oficiais do Clanix Agenda) e acrescentar tema escuro com escolha Automático / Claro / Escuro em Ajustes.

**Architecture:** Cores viram tokens semânticos em `src/styles/index.css` (`:root` claro, `.dark` escuro) expostos ao Tailwind v4; os ~420 hex soltos dos componentes são trocados por esses nomes, área por área, com um teste-guarda que proíbe hex/paleta Tailwind fora de uma lista que encolhe a cada tarefa. O tema é aplicado antes da primeira pintura por `public/tema.js` (script clássico externo, permitido pela CSP) e mantido em tempo real por `src/lib/theme.ts`.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind v4 (`@theme inline`, `@custom-variant dark`), shadcn/Radix, sonner, `@fontsource-variable/sora` + `@fontsource-variable/inter`, vite-plugin-pwa + `@vite-pwa/assets-generator`, Vitest (jsdom/node), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-06-identidade-visual-clanix-design.md` (leia antes; os valores de cor citados como "spec" estão lá). Pacote da marca: `clanix-brand/` (fora do git; só existe na máquina do usuário).

## Global Constraints

- Layout, navegação, fluxos e textos não mudam; só a aparência (exceção: seção nova "Aparência" em Ajustes).
- WCAG AA nos dois temas: texto ≥ 4,5:1; texto grande, ícones de status, linha do "agora" e anel de foco ≥ 3:1.
- Alvos de toque ≥ 44 px; inputs ≥ 16 px no celular; foco visível; status sempre ícone + texto + cor.
- Gradiente só em: CTA principal das telas de entrada (Entrar, Criar conta, Primeiro acesso), botão "+" de novo agendamento, painel lateral do `AuthLayout`, card "Próximo atendimento" do Início.
- Ciano do Agenda (`#0284C7` claro / `#38BDF8` escuro) só na linha do "agora".
- Nada de script inline no `index.html`; nada de fonte `data:`; `localStorage` guarda só a preferência de tema (chave `clanix-tema`).
- Wordmark "Clanix" nunca redesenhado: só os SVGs oficiais (cópias sem o retângulo de fundo).
- Testes rodam com `TZ=Europe/Lisbon`; e2e falha em violação de CSP no console.
- Commits só se o usuário autorizar no início da execução (ver handoff); mensagens terminam com a linha `Co-Authored-By` do system-reminder.

## Review Focus

1. Portais (Dialog, Drawer/gaveta, Select, toasts do sonner, widget Turnstile) abertos no tema escuro devem ficar escuros — sonner hoje tem `theme="light"` fixo; Turnstile segue o sistema, não a preferência. Testes na Tarefa 2 (sonner) e Tarefa 4 (Turnstile).
2. `localStorage` indisponível (Safari privado, armazenamento bloqueado) não pode quebrar a abertura: vale Automático. Testes na Tarefa 1 (`theme.ts` e `tema.js`).
3. Em Automático, o sistema trocar de claro para escuro com o app aberto deve trocar o app na hora; com Claro/Escuro forçado, não. Teste na Tarefa 1.
4. Barra de status do PWA instalado: `<meta name="theme-color">` acompanha o tema resolvido a cada troca. Teste na Tarefa 1.
5. Texto `primary` sobre fundo escuro reprova AA (`#8A2BE2` em `#0B0420` = 4,0:1): links e textos "roxos" usam o token `link` (`#D8B4FF` no escuro). Teste de contraste na Tarefa 2 cobre todos os pares.

---

## Vocabulário de tokens (produzido pela Tarefa 2, usado por todas as outras)

Classes Tailwind (todas com valor claro/escuro; valores na spec, seções "Tokens de cor" e "Status"; os que a spec não lista estão aqui):

| Classe(s) | Claro | Escuro |
|---|---|---|
| `bg-background` | `#F8F7FF` | `#0B0420` |
| `bg-card` / `text-card-foreground` | `#FFFFFF` / `#0B0420` | `#140836` / `#F8F7FF` |
| `bg-elevated` (alias de `popover`) | `#FFFFFF` | `#1D0E4A` |
| `bg-muted` | `#F1EFFA` | `#11062C` |
| `text-foreground` / `text-foreground-secondary` / `text-muted-foreground` | `#0B0420` / `#494361` / `#696284` | `#F8F7FF` / `#D8B4FF` / `#9690B0` |
| `border-border` / `border-input` / `ring-ring` | `#E2DFEE` / `#C8C3DC` / `#8A2BE2` | `#28155A` / `#3F2385` / `#D8B4FF` |
| `bg-primary` / `bg-primary-hover` / `bg-primary-active` / `text-primary-foreground` | `#4A00B8` / `#6B12D0` / `#2E0075` / `#F8F7FF` | `#8A2BE2` / `#9E47F5` / `#6B12D0` / `#F8F7FF` |
| `text-link` | `#4A00B8` | `#D8B4FF` |
| `bg-secondary` / `border-secondary-border` / `text-secondary-foreground` | `#F0E8FF` / `#D8B4FF` / `#4A00B8` | `rgba(216,180,255,.10)` / `rgba(216,180,255,.30)` / `#D8B4FF` |
| `bg-accent` / `text-accent-foreground` (hover de itens) | `#F0E8FF` / `#4A00B8` | `rgba(216,180,255,.10)` / `#D8B4FF` |
| `bg-destructive` / `text-destructive-foreground` | `#B91C1C` / `#FFFFFF` | `#B91C1C` / `#FFFFFF` |
| `text-error` / `bg-error-surface` / `border-error-border` | `#B91C1C` / `#FEF2F2` / `#FCA5A5` | `#FCA5A5` / `rgba(239,68,68,.16)` / `rgba(248,113,113,.35)` |
| `*-success-surface` / `text-success-foreground` / `border-success-border` | `#ECFDF5` / `#065F46` / `#6EE7B7` | `rgba(16,185,129,.16)` / `#6EE7B7` / `rgba(52,211,153,.35)` |
| `*-warning-*` (mesmo padrão) | `#FFFBEB` / `#92400E` / `#FCD34D` | `rgba(245,158,11,.16)` / `#FCD34D` / `rgba(251,191,36,.35)` |
| `*-info-*` (mesmo padrão) | `#EFF6FF` / `#1E40AF` / `#93C5FD` | `rgba(59,130,246,.16)` / `#93C5FD` / `rgba(96,165,250,.35)` |
| `bg-status-{agendado,concluido,nao-compareceu,cancelado}` + `text-status-…-foreground` + `border-status-…-border` | spec "Status"; bordas: agendado `#D8B4FF`, concluído/não compareceu = success/warning border, cancelado `#C8C3DC` | bordas: agendado `rgba(216,180,255,.30)`, cancelado `#3F2385` |
| `bg-agenda` / `text-agenda` | `#0284C7` | `#38BDF8` |
| `bg-gradient-brand` (utilitário) | `linear-gradient(135deg,#4A00B8 0%,#8A2BE2 65%,#B980FF 100%)` | igual |
| `bg-gradient-fab` (utilitário) | `linear-gradient(135deg,#4A00B8,#8A2BE2)` | `linear-gradient(135deg,#6B12D0,#9E47F5)` |
| `bg-gradient-hero` / `text-hero-foreground` / `text-hero-secondary` | `linear-gradient(145deg,#16063E 0%,#0B0420 60%,#24075E 100%)` / `#F8F7FF` / `#D8B4FF` | igual |
| `shadow-sm/md/lg/glow` | valores de `clanix-brand/design-tokens/variables.css` | idem (bloco `[data-theme="dark"]`) |
| `font-display` / `font-sans` | Sora Variable / Inter Variable | — |
| `rounded-card` 16 px, `rounded-control` 12 px (botões), `rounded-field` 10 px (inputs) | — | — |

Somem: `navy`, `brand`, `brand-strong`, `soft`, `line`, `canvas`, `muted-surface` e o mapeamento torto `--color-muted: var(--muted-foreground)` (passa a ser a superfície `#F1EFFA`). "Destaque sólido" (próximo atendimento, hoje, chip/filtro selecionado, passos numerados) = `bg-primary text-primary-foreground`.

---

### Task 1: Motor de tema (preferência, aplicação antes da pintura, troca em tempo real)

**Files:**
- Create: `src/lib/theme.ts`, `src/lib/theme.test.ts`, `public/tema.js`, `src/lib/tema-js.test.ts`
- Modify: `index.html`, `src/main.tsx`

**Interfaces:**
- Produces (`src/lib/theme.ts`):
  - `type ThemePreference = 'auto' | 'claro' | 'escuro'`; `type ResolvedTheme = 'light' | 'dark'`
  - `THEME_STORAGE_KEY = 'clanix-tema'`; `THEME_COLORS: Record<ResolvedTheme, string> = { light: '#F8F7FF', dark: '#0B0420' }`
  - `readThemePreference(): ThemePreference` (try/catch; ausente/inválido/erro → `'auto'`)
  - `resolveTheme(p: ThemePreference, systemDark: boolean): ResolvedTheme`
  - `applyTheme(resolved: ResolvedTheme, doc?: Document): void` — classe `dark` no `<html>`, `style.colorScheme`, `content` do `meta[name="theme-color"]`
  - `initTheme(): void` — aplica e passa a ouvir `matchMedia('(prefers-color-scheme: dark)')` (só reaplica se a preferência for `'auto'`); idempotente
  - `setThemePreference(p: ThemePreference): void` — grava (`'auto'` remove a chave; erro de storage ignorado), aplica, notifica
  - `useTheme(): { preference: ThemePreference; resolved: ResolvedTheme; setPreference: (p: ThemePreference) => void }` (via `useSyncExternalStore`)

- [ ] **Step 1: Write the failing tests** (`src/lib/theme.test.ts`), com `matchMedia` falso controlável e `localStorage` limpo a cada teste:

```ts
it('sem preferência salva vale automático e segue o sistema', () => {
  expect(readThemePreference()).toBe('auto');
  expect(resolveTheme('auto', true)).toBe('dark');
  expect(resolveTheme('auto', false)).toBe('light');
  expect(resolveTheme('claro', true)).toBe('light');
  expect(resolveTheme('escuro', false)).toBe('dark');
});
it('valor inválido ou storage que lança vira automático', () => {
  localStorage.setItem('clanix-tema', 'roxo');
  expect(readThemePreference()).toBe('auto');
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
  expect(readThemePreference()).toBe('auto');
});
it('applyTheme liga a classe dark, color-scheme e theme-color', () => {
  applyTheme('dark');
  expect(document.documentElement.classList.contains('dark')).toBe(true);
  expect(document.documentElement.style.colorScheme).toBe('dark');
  expect(document.querySelector('meta[name="theme-color"]')!.getAttribute('content')).toBe('#0B0420');
  applyTheme('light');
  expect(document.documentElement.classList.contains('dark')).toBe(false);
  expect(document.querySelector('meta[name="theme-color"]')!.getAttribute('content')).toBe('#F8F7FF');
});
it('em automático acompanha a troca do sistema; forçado ignora', () => {
  initTheme(); systemDark(true);
  expect(document.documentElement.classList.contains('dark')).toBe(true);
  setThemePreference('claro'); systemDark(true);
  expect(document.documentElement.classList.contains('dark')).toBe(false);
  expect(localStorage.getItem('clanix-tema')).toBe('claro');
  setThemePreference('auto');
  expect(localStorage.getItem('clanix-tema')).toBeNull();
});
it('setThemePreference não quebra com storage bloqueado', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('cheio'); });
  expect(() => setThemePreference('escuro')).not.toThrow();
  expect(document.documentElement.classList.contains('dark')).toBe(true);
});
it('useTheme re-renderiza ao trocar a preferência', () => { /* renderHook: setPreference('escuro') → resolved 'dark' */ });
```

O teste cria o `<meta name="theme-color">` no `beforeEach` (jsdom não carrega o `index.html`).

`src/lib/tema-js.test.ts`: lê `public/tema.js` com `fs`, executa com `new Function(src)()` para as 6 combinações (preferência `auto`/`claro`/`escuro`/ausente/inválida/storage que lança × sistema claro/escuro) e confere que classe `dark`, `colorScheme` e `theme-color` batem com `resolveTheme` + `THEME_COLORS`. Também confere que `tema.js` usa a mesma chave `clanix-tema`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/theme.test.ts src/lib/tema-js.test.ts`
Expected: FAIL (módulo e arquivo inexistentes)

- [ ] **Step 3: Implement `src/lib/theme.ts` and `public/tema.js`**

`public/tema.js` é ES5, IIFE, sem dependências, mesma regra de `readThemePreference` + `resolveTheme` + `applyTheme` (comentário no topo apontando para `src/lib/theme.ts` como par que precisa ficar igual).

- [ ] **Step 4: Wire it**

`index.html`: `<meta name="color-scheme" content="light dark" />`, `theme-color` inicial `#F8F7FF`, e `<script src="/tema.js"></script>` no `<head>` **depois** do meta `theme-color` (sem `type="module"`, sem `async`/`defer`). `src/main.tsx`: `initTheme()` antes do `createRoot`.

- [ ] **Step 5: Run tests, typecheck and build**

Run: `npx vitest run src/lib && npm run typecheck && npm run build`
Expected: PASS; o build mantém `<script src="/tema.js">` no `dist/index.html` e `dist/tema.js` existe; `dist/_headers` sem mudança de CSP.

- [ ] **Step 6: Commit** — `feat(tema): preferência claro/escuro/automático aplicada antes da primeira pintura`

---

### Task 2: Tokens, fontes, guarda de cores e componentes-base

**Files:**
- Modify: `src/styles/index.css`, `package.json`/`package-lock.json` (+ `@fontsource-variable/sora`, − `@fontsource-variable/manrope`), `src/components/ui/{button,input,select,textarea,switch,tabs,dialog,drawer,sonner}.tsx`, `src/components/feedback/{EmptyState,ErrorState,LoadingState}.tsx`, `src/components/layout/{AppShell,SideRail,BottomNav,OfflineBanner,PageFallback,RouteError,ResponsiveSheet,UpdatePrompt}.tsx`, `src/pages/NotFoundPage.tsx` e os testes destes que conferem hex
- Create: `src/styles/cores.test.ts` (guarda), `src/styles/contraste.test.ts`

**Interfaces:**
- Consumes: `useTheme().resolved` (Task 1) no `Toaster`.
- Produces: o vocabulário de tokens acima; `PENDENTES` em `src/styles/cores.test.ts` (lista de arquivos ainda não migrados que as tarefas seguintes encolhem).

- [ ] **Step 1: Write the guard test** `src/styles/cores.test.ts` (projeto `app`, lê arquivos com `fs` + `globSync` de `node:fs`): varre `src/**/*.{ts,tsx}` exceto `*.test.*`, `src/types/**`, `src/test/**`; reprova cada ocorrência de:
  - hex `#[0-9A-Fa-f]{3,8}\b`;
  - paleta Tailwind `\b(bg|text|border|ring|outline|from|via|to|fill|stroke|divide|decoration|placeholder)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b` e `\b(bg|text|border)-(white|black)\b`;
  - nomes antigos `\b(bg|text|border)-(navy|brand|brand-strong|soft|line|canvas|muted-surface)\b`.
  Exceções fixas (`PERMITIDOS`, com motivo em comentário): `src/lib/theme.ts` (`THEME_COLORS`), `src/features/settings/sections/FavoritesSection.tsx` (paleta é dado do usuário), `src/features/auth/captcha/turnstile.ts` se precisar. `PENDENTES` começa com todos os arquivos de `src/features/**` que hoje reprovam (gerar a lista rodando o teste uma vez) — o teste só olha arquivos fora de `PERMITIDOS ∪ PENDENTES` e, em outro `it`, falha se algum arquivo de `PENDENTES` já estiver limpo ("tire da lista").

`src/styles/contraste.test.ts`: lê `src/styles/index.css`, extrai as variáveis de `:root` e de `.dark` (hex e `rgba`; `rgba` é composto sobre o fundo do par) e confere razão WCAG:
  - ≥ 4,5: `foreground`, `foreground-secondary`, `muted-foreground`, `link`, `error`, `card-foreground` sobre `background`, `card` e `muted`; `primary-foreground` sobre `primary` e `primary-hover`; `secondary-foreground` sobre `secondary`(sobre `card`); `destructive-foreground` sobre `destructive`; `{success,warning,info}-foreground` sobre a própria superfície (sobre `card`); `status-*-foreground` sobre `status-*` (sobre `card`); `hero-foreground` e `hero-secondary` sobre cada parada do gradiente hero (`#16063E`, `#0B0420`, `#24075E`).
  - ≥ 3: `agenda` e `ring` sobre `background` e `card`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/styles`
Expected: FAIL (contraste: variáveis novas ausentes; guarda: `src/components/**` e `src/pages/**` com hex)

- [ ] **Step 3: Rewrite `src/styles/index.css`**: `@import '@fontsource-variable/sora'` no lugar de Manrope; `:root` e `.dark` com todas as variáveis do vocabulário; `@theme inline` mapeando `--color-*`, `--font-display: 'Sora Variable', …`, raios e sombras; `@utility bg-gradient-brand|bg-gradient-fab|bg-gradient-hero`; base: `body` com `bg-background text-foreground font-sans`, `h1,h2,h3` em `font-display` com a escala da spec (h1 700 28/36 −0,02em; h2 600 22/30 −0,015em; h3 600 18/26 −0,01em) e utilitário `tabular-nums` onde houver horário. Remova `navy/brand/soft/line/canvas/muted-surface`.

- [ ] **Step 4: Migrate `src/components/**` and `src/pages/**`** para o vocabulário: botão primário `rounded-control h-11 bg-primary hover:bg-primary-hover active:bg-primary-active text-primary-foreground font-semibold`; secundário com borda 1,5 px `secondary`; inputs/select/textarea `rounded-field border-input bg-card px-3.5 text-base focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25`; dialog/drawer `bg-elevated`; `SideRail`/`BottomNav` em `bg-card`, item ativo `bg-secondary text-secondary-foreground` (barra lateral) / `text-link` (navegação inferior); botão "+" `bg-gradient-fab shadow-glow` com borda de recorte `border-background`; sonner com `theme={resolved}` e `--normal-bg: var(--popover)`. Atualize asserts de hex nos testes desses arquivos para as classes novas.

- [ ] **Step 5: Run tests, lint, typecheck**

Run: `npm test && npm run lint && npm run typecheck`
Expected: PASS (guarda passa porque `src/features/**` está em `PENDENTES`)

- [ ] **Step 6: Commit** — `feat(marca): tokens Clanix claro/escuro, Sora + Inter e componentes-base`

---

### Task 3: Logo, ícones, PWA e APK

**Files:**
- Create: `scripts/copiar-marca.mjs`, `scripts/copiar-marca.d.mts`, `scripts/copiar-marca.test.ts`, `src/assets/brand/clanix-agenda-horizontal-claro.svg`, `src/assets/brand/clanix-agenda-horizontal-escuro.svg`, `src/assets/brand/clanix-agenda-icone.svg`, `src/assets/brand/ORIGEM.md`
- Modify: `src/components/brand/Logo.tsx`, `src/components/brand/Logo.test.tsx`, todos os usos de `<Logo>` (`SideRail`, `AuthLayout`, `InstallPage`, `PrivacyPage`, `NotificationsSection`), `public/favicon.svg` + PNGs/ICO gerados, `public/logo-*.svg` (substituir ou apagar se nada mais usa), `pwa-assets.config.ts`, `vite.config.ts` (manifesto), `android/twa-manifest.template.json`, `tests/e2e/pwa.spec.ts`, `docs/guia-apk-android.md`, `package.json` (script `marca:copiar`)
- Delete: `src/components/brand/wordmark-paths.ts`

**Interfaces:**
- Produces: `semFundo(svg: string): string` (exportada de `scripts/copiar-marca.mjs`); `Logo({ variant: 'horizontal' | 'icone'; size?: number; tone?: 'auto' | 'sobre-escuro' })` — `size` é a altura em px; `horizontal` + `auto` escolhe claro/escuro por `useTheme().resolved`; `sobre-escuro` sempre a versão escura; renderiza `<img alt="Clanix Agenda">`.
- Consumes: `useTheme` (Task 1).

- [ ] **Step 1: Write failing tests**
  - `scripts/copiar-marca.test.ts`: `semFundo` remove só o `<rect>` cuja largura/altura são iguais às do `viewBox` e sem `x`/`y` (o fundo `#F8F7FF`/`#0B0420` dos logos horizontais), mantendo o resto byte a byte; lança `Error` se não houver exatamente um retângulo de fundo; não altera `viewBox`.
  - `Logo.test.tsx`: `horizontal` com tema claro → `img` com `src` do arquivo claro; com `dark` → arquivo escuro; `tone="sobre-escuro"` → escuro mesmo no claro; `icone` → ícone; todos com nome acessível "Clanix Agenda" e `height` = `size`.
  - `tests/e2e/pwa.spec.ts`: `theme_color: '#0B0420'`, `background_color: '#0B0420'`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run scripts/copiar-marca.test.ts src/components/brand`
Expected: FAIL

- [ ] **Step 3: Implement `scripts/copiar-marca.mjs`** (`npm run marca:copiar`): lê de `clanix-brand/` (erro claro se a pasta não existir), grava `products/clanix-agenda/logo-clanix-agenda-horizontal-{light,dark}.svg` → `src/assets/brand/clanix-agenda-horizontal-{claro,escuro}.svg` passando por `semFundo`; `products/clanix-agenda/icon-clanix-agenda.svg` → `src/assets/brand/clanix-agenda-icone.svg` e `public/favicon.svg` sem alteração. `ORIGEM.md` lista origem de cada arquivo e a única alteração (retângulo de fundo removido). Rode o script.

- [ ] **Step 4: Rewrite `Logo.tsx`** (imports de asset do Vite) e os usos: `SideRail` → `icone` 44; `AuthLayout` → `horizontal` `tone="sobre-escuro"` 44; `InstallPage`/`PrivacyPage` → `horizontal` 36; `NotificationsSection` → `icone` 36. Apague `wordmark-paths.ts`.

- [ ] **Step 5: Regenerate icons and colors**: `pwa-assets.config.ts` com fundo `#0B0420` em `maskable` e `apple`; rode `npx pwa-assets-generator`; abra `public/pwa-512x512.png`, `maskable-icon-512x512.png` e `apple-touch-icon-180x180.png` para conferir que mostram o C com relógio, sem corte. Manifesto (`vite.config.ts`) e `android/twa-manifest.template.json`: `theme_color`/`themeColor`/`navigationColor`/`background_color`/`backgroundColor` = `#0B0420`. `docs/guia-apk-android.md`: cores novas.

- [ ] **Step 6: Run tests and build**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS; `dist/manifest.webmanifest` com `#0B0420`.

- [ ] **Step 7: Commit** — `feat(marca): logo e ícones oficiais do Clanix Agenda (PWA, favicon, APK)`

---

### Task 4: Telas de entrada e páginas públicas

**Files:**
- Modify: `src/features/auth/AuthLayout.tsx`, `src/features/auth/pages/{Login,Signup,ForgotPassword,ResetPassword}.tsx`, `src/features/auth/captcha/{useCaptcha.tsx,turnstile.ts}`, `src/features/install/{InstallPage,IosInstallBanner}.tsx`, `src/features/legal/PrivacyPage.tsx`, `src/features/business-hours/pages/FirstAccessPage.tsx`, `src/features/business-hours/components/HoursEditor.tsx`, os testes desses arquivos; `src/styles/cores.test.ts` (tirar de `PENDENTES`)

**Interfaces:**
- Consumes: vocabulário (Task 2), `Logo` (Task 3), `useTheme` (Task 1).

- [ ] **Step 1: Write failing tests**
  - `useCaptcha`/`turnstile`: o widget é renderizado com `theme: 'dark'` quando `useTheme().resolved === 'dark'` e `'light'` no claro (o teste usa o `turnstile` falso já existente e confere as opções recebidas).
  - `AuthLayout` (teste novo ou existente): o painel lateral tem `bg-gradient-hero` e o botão principal de Login/Cadastro tem `bg-gradient-brand`.
- [ ] **Step 2: Run to verify they fail** — `npx vitest run src/features/auth` → FAIL
- [ ] **Step 3: Migrate** os arquivos listados: painel do `AuthLayout` `bg-gradient-hero` com `text-hero-foreground`/`text-hero-secondary`, ícones dos benefícios em `bg-white/10` → token (`bg-hero-foreground/10`); CTA principal de Login, Cadastro e Primeiro acesso `bg-gradient-brand text-primary-foreground`; demais botões sólidos; erros em `text-error`/`bg-error-surface`; passos numerados de Instalar em `bg-primary text-primary-foreground`. `turnstile.ts` passa a aceitar `theme` nas opções de render.
- [ ] **Step 4: Run** `npm test && npm run lint` → PASS (arquivos fora de `PENDENTES`)
- [ ] **Step 5: Commit** — `feat(marca): telas de entrada e páginas públicas na identidade Clanix`

---

### Task 5: Agenda (dia, semana, mês, lista) e status

**Files:**
- Modify: `src/features/appointments/domain/status.ts`, `src/features/calendar/views/{DayView,WeekView,MonthView,ListView}.tsx`, `src/features/calendar/components/{NowLine,AgendaToolbar,ViewSwitcher,StatusFilter}.tsx`, `src/features/calendar/pages/AgendaPage.tsx`, testes (`MonthView.test.tsx`, `WeekView.test.tsx` e outros que conferem hex); `src/styles/cores.test.ts`

**Interfaces:**
- Consumes: classes `status-*`, `agenda`, `primary` (Task 2).
- Produces: `statusMeta[status].className` = `bg-status-<s> text-status-<s>-foreground` (com `<s>` em `agendado|concluido|nao-compareceu|cancelado`); a forma do objeto não muda.

- [ ] **Step 1: Update tests first**: `MonthView.test.tsx` passa a esperar `bg-status-cancelado` no lugar de `bg-[#F1F5F9]` e `border-primary` (hoje) no lugar de `border-[#3B82F6]`; `WeekView.test.tsx` idem para as classes de status/hoje; teste de `status.ts` (novo, curto): cada status tem ícone, rótulo e classe `bg-status-*`.
- [ ] **Step 2: Run to verify they fail** — `npx vitest run src/features/calendar src/features/appointments/domain` → FAIL
- [ ] **Step 3: Migrate**: blocos da semana `border-status-*-border bg-status-* text-status-*-foreground` (cancelado continua tracejado); hachurado fora do expediente `repeating-linear-gradient(135deg,var(--muted) 0 6px,var(--background) 6px 12px)`; "próximo" e "hoje" em `bg-primary text-primary-foreground`; `NowLine` em `bg-agenda`/`text-agenda`; horários com `tabular-nums`.
- [ ] **Step 4: Run** `npm test && npm run lint` → PASS
- [ ] **Step 5: Commit** — `feat(marca): agenda e status nas cores Clanix`

---

### Task 6: Atendimentos, Início e Histórico

**Files:**
- Modify: `src/features/appointments/components/{AppointmentForm,AppointmentSheet,StatusActions,ConflictPanel,HistoryList,CancelDialog}.tsx`, `src/features/appointments/pages/ReschedulePage.tsx`, `src/features/account/DeleteAccountDialog.tsx`, `src/features/dashboard/DashboardPage.tsx`, `src/features/history/HistoryPage.tsx`, testes (`DashboardPage.test.tsx` e outros com hex); `src/styles/cores.test.ts`

- [ ] **Step 1: Update tests first**: `DashboardPage.test.tsx` (linhas que esperam `text-[#0F2D5B]`/`#64748B`) passa a esperar `text-foreground` (dia com expediente) e `text-muted-foreground` (fechado); card "Próximo atendimento" tem `bg-gradient-brand`.
- [ ] **Step 2: Run to verify they fail** — `npx vitest run src/features/dashboard src/features/appointments src/features/history` → FAIL
- [ ] **Step 3: Migrate** os arquivos: chips selecionados no formulário `bg-primary text-primary-foreground`; ações destrutivas `bg-destructive text-destructive-foreground`; avisos de conflito `warning-*`; card "Próximo atendimento" `bg-gradient-brand text-primary-foreground` (texto secundário `text-hero-secondary`).
- [ ] **Step 4: Run** `npm test && npm run lint` → PASS
- [ ] **Step 5: Commit** — `feat(marca): atendimentos, Início e Histórico na identidade Clanix`

---

### Task 7: Ajustes e seção Aparência

**Files:**
- Create: `src/features/settings/sections/AppearanceSection.tsx`, `src/features/settings/sections/AppearanceSection.test.tsx`
- Modify: `src/features/settings/SettingsPage.tsx` (+ teste), `src/features/settings/sections/{shared,AccountSection,AgendaPrefsSection,FavoritesSection,HoursSection,NotificationsSection,ProfileSection,useAutoSaveProfile}.tsx` (+ testes com hex), `scripts/dados-teste-local.mjs` (cores da paleta), `src/styles/cores.test.ts` (`PENDENTES` vazio e o `it` que exige lista vazia)

**Interfaces:**
- Consumes: `useTheme` (Task 1), `SectionCard`/`ChoiceGroup` de `shared.tsx`.
- Produces: seção `{ slug: 'aparencia', label: 'Aparência' }` depois de `agenda` em `SECTIONS`; renderizada sem depender do perfil (como `servicos`).

- [ ] **Step 1: Write failing tests**
  - `AppearanceSection.test.tsx`: mostra `ChoiceGroup` "Tema" com "Automático", "Claro", "Escuro" e a descrição "Vale só para este aparelho."; começa em "Automático"; escolher "Escuro" liga `dark` no `<html>` e grava `clanix-tema=escuro`; escolher "Automático" remove a chave.
  - `SettingsPage.test.tsx`: a navegação lista "Aparência" e `/ajustes/aparencia` abre a seção mesmo com o perfil carregando.
  - `FavoritesSection` (teste de unidade da paleta): cada cor de `FAVORITE_COLORS` tem contraste ≥ 3:1 sobre `#FFFFFF` e sobre `#140836` (reaproveite a função de contraste de `src/styles/contraste.test.ts` movendo-a para `src/test/contrast.ts`).
  - `src/styles/cores.test.ts`: `PENDENTES` vazio.
- [ ] **Step 2: Run to verify they fail** — `npx vitest run src/features/settings src/styles` → FAIL
- [ ] **Step 3: Implement** `AppearanceSection` e o registro em `SettingsPage`; migre `shared.tsx` (`PRIMARY_BTN`, `FIELD`, `SectionCard` `rounded-card bg-card border-border`, `ChoiceGroup` marcado `border-ring bg-secondary text-secondary-foreground`) e as seções; troque na paleta a cor que reprovar (esperado: Cinza `#475569` → `#64748B`, confirme pelo teste). `scripts/dados-teste-local.mjs`: serviços favoritos só com hex de `FAVORITE_COLORS`.
- [ ] **Step 4: Run** `npm test && npm run lint && npm run typecheck` → PASS (guarda com `PENDENTES` vazio)
- [ ] **Step 5: Commit** — `feat(ajustes): seção Aparência e Ajustes na identidade Clanix`

---

### Task 8: e2e do tema, documentação e verificação final

**Files:**
- Create: `tests/e2e/tema.spec.ts`
- Modify: `tests/e2e/capturas.spec.ts` (saída em `.superpowers/sdd/2026-11-06-identidade-visual/screens/<projeto>/<tema>/`, rodando claro e escuro), `CLAUDE.md` (convenções: paleta e fontes Clanix, tema escuro, `tema.js`, `marca:copiar`), `README.md`, `docs/superpowers/specs/2026-10-29-agenda-em-ordem-design.md` (nota no topo apontando para a spec nova), memória do projeto se mudar alguma decisão

- [ ] **Step 1: Write `tests/e2e/tema.spec.ts`** (todos os projetos de aparelho):
  - `page.emulateMedia({ colorScheme: 'dark' })` antes de abrir `/entrar` → `<html>` tem classe `dark` e `meta[name=theme-color]` = `#0B0420` já no `DOMContentLoaded` (antes do React).
  - Logado, em `/ajustes/aparencia`, escolher "Claro" com o sistema escuro → sem `dark`; recarregar → continua claro (veio de `tema.js`).
  - Abrir a gaveta de novo agendamento no escuro → o fundo computado da gaveta é `rgb(29, 14, 74)` (`#1D0E4A`).
  - Nenhum desses passos gera violação de CSP (a fixture já falha nisso).
- [ ] **Step 2: Run** `npx playwright test tema --project=chromium-desktop` → PASS (precisa da pilha local: `npm run db:start` + `npm run lembretes:local`)
- [ ] **Step 3: Full verification**: `npm run format && npm run lint && npm run typecheck && npm test && npm run build && npm run e2e` → tudo PASS.
- [ ] **Step 4: Visual review**: `E2E_CAPTURAS=1 npx playwright test capturas` e abrir as capturas de claro e escuro (celular e computador), procurando: tela/portal claro no escuro, texto ilegível, logo com "caixa", gradiente fora dos lugares permitidos. Corrigir o que aparecer antes de concluir.
- [ ] **Step 5: Docs** conforme a lista de arquivos.
- [ ] **Step 6: Commit** — `test(tema): e2e do tema escuro; docs da identidade Clanix`
