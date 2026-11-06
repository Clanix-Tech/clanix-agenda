# Identidade visual Clanix e tema escuro — design

Data: 06/11/2026. Fontes da marca: `clanix-brand/` (pacote oficial: logos, símbolos, ícones, `design-tokens/variables.css`, `typography/`) e `clanix-brand/brand-guidelines/Clanix_Manual_Identidade_Visual.pdf` (mesmo PDF de `manual-marca/`).

## Intenção

O produto deixou de se chamar "Agenda em Ordem" e passou a ser o **Clanix Agenda**, parte do ecossistema Clanix (Finance, Agenda, ERP, CRM), que adota arquitetura de marca monolítica: todos os produtos compartilham o mesmo DNA visual, tipográfico e cromático. O app ainda usa o visual provisório (azul-marinho `#0F2D5B`, azul `#2563EB`, Manrope + Inter, logo de calendário). Esta mudança troca a "pele" do app inteiro pela identidade Clanix e acrescenta o tema escuro que o manual define, para que o Agenda pareça, desde a primeira publicação, um produto Clanix.

## Objetivos

- Todo o app (celular e computador, todas as telas, públicas e logadas) com a paleta, tipografia e componentes do manual Clanix.
- Tema escuro completo, com escolha **Automático / Claro / Escuro** em Ajustes; Automático segue o sistema e é o padrão.
- Logo, favicon, ícones do PWA, ícone das notificações e APK com os ativos oficiais do Clanix Agenda.
- Cores definidas num só lugar (tokens semânticos); componentes sem hex solto.

## Não-objetivos

- Mudar layout, navegação, fluxos ou textos das telas (o "Painel em Blocos" continua; só muda a aparência).
- Mudar banco, RPCs ou regras de negócio.
- Guardar a preferência de tema na conta (decidido: fica só no aparelho).
- Atualizar as telas de referência antigas em `docs/design/telas/` (ficam como registro histórico, como as specs).
- Personalizar os e-mails do Supabase Auth.

## Anti-objetivos (falharia mesmo "funcionando")

- Redesenhar ou redigitar o wordmark "Clanix" com fonte comum (proibido pelo manual): só arquivos oficiais.
- Qualquer texto ou status abaixo de WCAG AA (4,5:1 texto normal; 3:1 texto grande/elementos de UI) em qualquer um dos temas.
- Tema escuro "pela metade": alguma tela, modal, toast, gaveta ou estado (vazio, erro, carregando, offline) que fique claro no modo escuro ou ilegível.
- Piscar tema claro antes do escuro ao abrir o app.
- Brilho/gradiente em telas operacionais (o manual reserva gradiente para símbolo, CTA principal, splash e login).
- Quebrar a CSP (sem script inline no `index.html`, sem fonte `data:`), ou guardar algo além da preferência de tema no `localStorage`.

## Restrições do projeto (continuam valendo)

Alvos de toque ≥ 44 px; inputs ≥ 16 px no celular; foco visível; status sempre com ícone + texto + cor; texto em pt-BR, datas `DD/MM/AAAA`, 24 h; nada de botão falso; e2e roda com a CSP real e falha em violação no console; fontes woff2 nunca embutidas como `data:`; fuso do perfil continua a fonte de verdade.

## Abordagens consideradas

1. **Tokens semânticos centralizados (escolhida).** Cores do manual definidas uma vez em `src/styles/index.css` (valores claros em `:root`, escuros em `.dark`), expostas ao Tailwind por função (`bg-background`, `text-foreground`, `bg-primary`, `status-*`…). Componentes trocam os ~420 hex soltos por esses nomes. O tema escuro só troca os valores. Custo: passa por quase todos os componentes agora; ganho: ajuste futuro num lugar só e base reaproveitável pelos outros produtos Clanix.
2. **Trocar hex por hex e acrescentar `dark:` em cada classe.** Dobra as classes, fácil esquecer casos no escuro, cada ajuste futuro volta a tocar dezenas de arquivos. Descartada.
3. **Mudar só o arquivo de tema.** Não funciona: a maioria das cores não passa pelo tema hoje.

O usuário escolheu a 1 em 06/11/2026, depois de aprovar os protótipos (login e agenda do dia, claro e escuro) no companheiro visual.

## Decisões

### Tokens de cor

Valores tirados de `clanix-brand/design-tokens/variables.css` e da seção 7 do manual. Nomes semânticos (mantendo os que o shadcn já usa):

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `background` (canvas) | `#F8F7FF` | `#0B0420` | fundo da página |
| `card` / `popover` (surface) | `#FFFFFF` | `#140836` | cards, barra lateral, navegação inferior |
| `elevated` | `#FFFFFF` | `#1D0E4A` | modais, gavetas, menus |
| `muted` (surface muted) | `#F1EFFA` | `#11062C` | fundos sutis, segmentados, skeleton |
| `foreground` | `#0B0420` | `#F8F7FF` | texto principal e títulos |
| `foreground-secondary` | `#494361` | `#D8B4FF` | texto secundário |
| `muted-foreground` | `#696284` | `#9690B0` | texto auxiliar, ícones inativos |
| `border` | `#E2DFEE` | `#28155A` | bordas sutis |
| `input` (border strong) | `#C8C3DC` | `#3F2385` | borda de campos |
| `ring` | `#8A2BE2` | `#D8B4FF` | foco (anel de 3 px) |
| `primary` / hover / active | `#4A00B8` / `#6B12D0` / `#2E0075` | `#8A2BE2` / `#9E47F5` / `#6B12D0` | botão primário, links, item ativo |
| `primary-foreground` | `#F8F7FF` | `#F8F7FF` | texto sobre primário |
| `secondary` bg / borda / texto | `#F0E8FF` / `#D8B4FF` / `#4A00B8` | `rgba(216,180,255,.10)` / `rgba(216,180,255,.30)` / `#D8B4FF` | botão secundário, chips, item ativo da navegação |
| `destructive` | `#B91C1C` | `#B91C1C` (fundo de botão); texto de erro `#FCA5A5` | erro e ações destrutivas |
| `agenda` (acento do produto) | `#0284C7` | `#38BDF8` | só a linha do "agora" e detalhes pontuais do produto |

O `input` (`#C8C3DC` claro / `#3F2385` escuro, cerca de 1,6 a 1,7:1) é mantido como exceção de marca: os campos sempre têm rótulo visível e a borda de foco tem pelo menos 5,9:1.

`#EF4444` (danger-main do pacote) não serve como fundo de botão com texto branco (3,8:1), por isso o botão destrutivo fica `#B91C1C` nos dois temas.

### Status dos atendimentos (ícone + texto + cor)

| Status | Claro (fundo / texto) | Escuro (fundo / texto) |
|---|---|---|
| Agendado | `#F0E8FF` / `#4A00B8` | `rgba(216,180,255,.12)` / `#D8B4FF` |
| Concluído | `#ECFDF5` / `#065F46` | `rgba(16,185,129,.16)` / `#6EE7B7` |
| Não compareceu | `#FFFBEB` / `#92400E` | `rgba(245,158,11,.16)` / `#FCD34D` |
| Cancelado | `#F1EFFA` / `#494361` | `#11062C` / `#9690B0` |

Os blocos de atendimento nas visões de semana/mês seguem as mesmas cores de status. *(Decisão de implementação)* O papel de "destaque sólido" que hoje usa azul-marinho `#0F2D5B` com texto branco (atendimento "próximo" no dia e na semana, que continua sobrepondo a cor do status como hoje; dia de hoje nos calendários; chips e filtros selecionados; passos numerados de Instalar e Notificações) passa a usar `primary` sólido (`#4A00B8` claro / `#8A2BE2` escuro). O card grande "Próximo atendimento" do Início usa o gradiente institucional, como o card de destaque do dashboard de referência do manual (Figura 3). Avisos (banner offline, alertas) usam o par de alerta do pacote (`warning`), informações usam `info`.

### Tipografia

- `@fontsource-variable/sora` substitui `@fontsource-variable/manrope`; Inter continua. `--font-display` = Sora, `--font-sans` = Inter.
- Escala do manual: h1 Sora 700 28/36 −0,02em; h2 Sora 600 22/30 −0,015em; h3 Sora 600 18/26 −0,01em; corpo Inter 14/20 (16/24 em inputs no celular); legenda/badge Inter 600 11/16 +0,04em.
- Horários e números em `tabular-nums`.

### Componentes

- Botão primário: altura ≥ 44 px, raio 12 px, Inter SemiBold 14–15 px, fundo `primary`. **Gradiente institucional** (`#4A00B8 → #8A2BE2 → #B980FF`) só no CTA principal das telas de entrada (Entrar, Criar conta, Primeiro acesso) e no botão "+" (novo agendamento); no escuro o "+" usa `#6B12D0 → #9E47F5` com borda de recorte `#0B0420`.
- Botão secundário: borda 1,5 px, cores `secondary`.
- Inputs/selects/textarea: altura ≥ 44 px, raio 10 px, padding 14 px, borda `input`, foco com borda `ring` + anel 3 px.
- Cards: raio 16 px, borda 1 px `border`, superfície `card`. Modais/gavetas em `elevated`.
- Badges: pílula 22–24 px, Inter SemiBold 11 px.
- Skeleton: `muted` → `border`.
- Sombras do pacote (`shadow-sm/md/lg`); `shadow-glow` só no "+".

### Tema escuro

- Preferência `'auto' | 'claro' | 'escuro'` em `localStorage` (chave única, leitura/escrita em try/catch; sem acesso → Automático). É preferência de exibição, não dado de cliente.
- Módulo puro em `src/lib/theme.ts`: resolve a preferência (Automático usa `matchMedia('(prefers-color-scheme: dark)')` e acompanha mudanças do sistema), aplica a classe `dark` em `<html>`, `color-scheme` e o `<meta name="theme-color">` do tema resolvido (claro `#F8F7FF`, escuro `#0B0420`).
- *(Decisão de implementação)* Para não piscar nem quando o tema é forçado: um script clássico pequeno e **externo** (`public/tema.js`, permitido por `script-src 'self'`, nunca inline) carregado de forma síncrona no `<head>` do `index.html` lê a preferência e aplica a classe `dark`/`color-scheme`/`theme-color` antes da primeira pintura. Ele entra no precache do service worker (o `globPatterns` atual já cobre `.js` de `public/`). `src/lib/theme.ts` reaproveita a mesma lógica para a troca em tempo real (seção Aparência e mudança do sistema em Automático). `index.html` também ganha `<meta name="color-scheme" content="light dark">`.
- Nova seção **Aparência** em Ajustes: grupo de opções (rádio) Automático / Claro / Escuro, com efeito imediato.
- O variant `dark` do Tailwind já existe (`@custom-variant dark (&:is(.dark *))`); com tokens, quase nenhum componente precisa de `dark:` próprio.

### Logo e ícones

- Ativos copiados de `clanix-brand/` para o app (sem redesenhar): logo horizontal do Clanix Agenda (versão clara e escura), ícone do Clanix Agenda (C com o relógio) e símbolo C.
- *(Decidido pelo usuário em 06/11/2026)* O pacote não tem versão transparente do logo do Agenda: os SVGs oficiais trazem um retângulo de fundo opaco (`#F8F7FF` / `#0B0420`). O app usa cópias desses SVGs **sem o retângulo de fundo**, sem nenhuma outra alteração (símbolo, letras, cores, proporções e viewBox intactos). Um teste confere que a cópia é o original menos esse elemento.
- *(Decidido pelo usuário em 06/11/2026)* Só os ativos usados pelo app são copiados e versionados; `clanix-brand/` e `manual-marca/` ficam fora do git (`.gitignore`), assim como `.superpowers/`. Os arquivos copiados citam a origem (caminho no pacote) num comentário ou README curto junto deles.
- Componente `Logo` passa a renderizar esses arquivos (`<img>` com `alt="Clanix Agenda"`), escolhendo a versão clara/escura conforme o tema; some o `wordmark-paths.ts` e o desenho de calendário.
- Barra lateral (computador): ícone do Clanix Agenda. Telas de entrada (login, cadastro, recuperar senha, instalar, privacidade): logo horizontal.
- *(Decisão de implementação)* O painel lateral das telas de entrada (`AuthLayout`: logo, "Tudo organizado em um só lugar." e os três benefícios; faixa no topo no celular) **continua**, porque o layout não muda; o protótipo em coluna única só servia para julgar cores e tipografia. O fundo do painel passa a ser o gradiente `surface-hero` do pacote (`#16063E → #0B0420 → #24075E`) nos dois temas (o manual libera gradiente no login), com o logo na versão para fundo escuro e textos `#F8F7FF`/`#D8B4FF`.
- `public/favicon.svg` = ícone do Clanix Agenda; `pwa-assets.config.ts` regenera favicon/PWA/maskable/apple-touch a partir dele, com fundo `#0B0420`.
- Manifesto PWA, `index.html` e `android/twa-manifest.template.json`: `theme_color`/`themeColor`/`navigationColor` `#0B0420`, `background_color`/`backgroundColor` `#0B0420` (splash escura com o ícone, como no manual).
- Notificações continuam usando `pwa-192x192.png` (ícone) e `pwa-64x64.png` (badge), regenerados.

### Cores dos serviços favoritos

A paleta de `FavoritesSection` (ponto colorido + nome, nunca só a cor) passa a exigir contraste ≥ 3:1 sobre a superfície dos dois temas (`#FFFFFF` e `#140836`); valores que não passarem são ajustados. O script `dados:teste` passa a usar só cores dessa paleta.

### Testes e documentação

- Testes que conferem classes com hex passam a conferir as classes semânticas.
- Testes novos: `theme.ts` (resolução, troca do sistema em Automático, falha do `localStorage`), seção Aparência, `Logo` (versão por tema); e2e com `colorScheme: 'dark'` conferindo a classe `dark` e a ausência de violações de CSP; `pwa.spec.ts` com as cores novas do manifesto.
- `CLAUDE.md` (convenções de cor/tipografia e "Painel em Blocos" com a pele Clanix), `README.md`, spec de design original (nota apontando para este documento) e `docs/guia-apk-android.md` (cores do TWA).

## Fica a critério de quem implementar

Nomes exatos das variáveis/utilitários do Tailwind, a ordem de migração dos componentes, se o `Logo` usa `import` de asset (hash do Vite) ou arquivo em `public/`, e ajustes finos de contraste dentro da paleta do pacote, sempre conferindo AA nos dois temas.
