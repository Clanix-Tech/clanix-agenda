# Guia de testes

Quatro camadas de teste, da mais rápida para a mais completa. Todos os comandos rodam na raiz do
repositório.

| Camada | Comando | Precisa do Supabase local? | O que cobre |
|---|---|---|---|
| Unitários | `npm test` | Não | Regras puras (horários, fuso, CSV), componentes e telas com um Supabase falso (Vitest + Testing Library, jsdom), a lógica das Edge Functions (`supabase/functions/**/handler.ts`, ambiente node, dependências falsas) e os scripts de Node (`scripts/*.test.ts`: cabeçalhos de segurança, verificação de produção, assetlinks). |
| Banco (pgTAP) | `npm run db:test` | Sim | Recria o banco local (`supabase db reset`) e roda os testes SQL de `supabase/tests`: RLS, RPCs, regras de conflito e expediente. |
| Integração | `npm run test:integration` | Sim | Chamadas reais à API local (RLS entre usuários, concorrência na criação de agendamentos) e à Edge Function `send-reminders` (exige `npm run vapid:gerar` e a pilha reiniciada depois; veja `docs/supabase-local.md`). |
| Ponta a ponta | `npm run e2e` | Sim | O build de produção no navegador (Playwright), com a CSP e os demais cabeçalhos do site publicado: computador, iPhone e Android; o service worker; e o caminho do lembrete cron → pg_net → função → banco. |

Antes de abrir um PR:

```bash
npm run typecheck && npm run lint && npx prettier --check . && npm test && npm run db:test && npm run lembretes:local && npm run test:integration && npm run e2e
```

O `npm run lembretes:local` vem logo depois do `db:test` porque o reset apaga o Vault (a URL da
função e o segredo do cron).

## Pré-requisitos

1. Node e dependências: `npm install`.
2. Docker Desktop em execução.
3. Supabase local deste projeto no ar: `npm run db:start` (detalhes em `docs/supabase-local.md`;
   as portas são as deslocadas (4432x), API em `44321` e Mailpit em `44324`).
4. Só para o e2e, os navegadores do Playwright (uma vez por máquina):
   `npx playwright install chromium webkit`.
5. Para os testes de lembretes (integração da `send-reminders`, guia do iPhone e cron no e2e), uma
   vez por máquina: `npm run vapid:gerar` e a pilha reiniciada (`npx supabase stop` e
   `npx supabase start`); veja [`notificacoes.md`](notificacoes.md). Sem `supabase/functions/.env`,
   esses testes do e2e são pulados com a mensagem do que falta; a integração da `send-reminders`
   falha pedindo o arquivo.

Atenção: `npm run db:test` apaga e recria o banco **local** deste projeto (usuários e agendamentos
de teste somem). Não afeta outros projetos Supabase da máquina.

## Testes ponta a ponta (Playwright)

- `npm run e2e` — roda tudo, sem interface, nos três projetos.
- `npm run e2e:ui` — modo interativo do Playwright (escolher teste, ver passo a passo).
- Um arquivo ou projeto: `npx playwright test tests/e2e/conflito.spec.ts --project=webkit-iphone`.
- Relatório da última execução: `npx playwright show-report` (pasta `playwright-report/`, ignorada
  pelo git). Em falha, `test-results/` guarda a captura da tela e o _trace_
  (`npx playwright show-trace <arquivo>.zip`).

### Projetos

| Projeto | Aparelho | Fuso do navegador |
|---|---|---|
| `chromium-desktop` | Chrome, 1440×900 | `Europe/Lisbon` (de propósito diferente do perfil) |
| `webkit-iphone` | iPhone 15 (Safari/WebKit) | `America/Sao_Paulo` |
| `chromium-android` | Pixel 7 (Chrome) | `America/Sao_Paulo` |
| `pwa` | Chrome, 1440×900, com o service worker liberado | da máquina |

Todos os projetos usam o mesmo build, servido pelo `vite preview` na porta `5174`. Os três aparelhos
rodam com o service worker bloqueado (`serviceWorkers: 'block'`): assim o `page.route` continua
interceptando as chamadas ao Supabase (o que passa pelo service worker escapa dele) e o estado de
Ajustes › Notificações é o de um navegador sem service worker. O projeto `pwa` roda só
`pwa.spec.ts`, com o service worker liberado (`serviceWorkers: 'allow'`).

O perfil de todo usuário de teste fica em `America/Sao_Paulo`; as datas e horas dos testes são
calculadas nesse fuso (próximos dias úteis, dentro do expediente seg–sex 09–12 e 13–18), então o
resultado não depende do dia, da hora nem do fuso da máquina.

### Como o ambiente é montado

- `playwright.config.ts` lê `npx supabase status -o json`, gera o build em modo `test` e o serve
  pelo preview na porta `5174` (`vite build --mode test && vite preview --port 5174`), passando só
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e, quando `supabase/functions/.env` existe,
  `VITE_VAPID_PUBLIC_KEY`. O build grava `dist/_headers` (o arquivo de cabeçalhos do Cloudflare
  Pages, com a CSP apontando para o Supabase local) e o preview aplica esse arquivo a cada resposta.
- Se já houver um servidor na porta `5174`, ele é reaproveitado (fora do CI) — inclusive com um build
  antigo. Depois de mudar o código, pare o preview que ficou aberto antes de rodar de novo. O
  global-setup recusa um servidor que responda sem `Content-Security-Policy` (por exemplo, um
  `vite` de desenvolvimento esquecido na porta), para os testes nunca rodarem sem a CSP.
- `tests/e2e/global-setup.ts` grava `.env.test.local` (ignorado pelo git) com essas variáveis
  públicas e guarda a chave secreta **apenas na memória** do processo de teste. A chave secreta nunca
  é escrita em arquivo nem chega ao navegador; ela só é usada no Node para criar usuários (API admin)
  e conferir o banco (ex.: contar agendamentos).
- Com `supabase/functions/.env`, o global-setup também grava no Vault local a URL da `send-reminders`
  e o `CRON_SECRET` (a mesma lógica de `npm run lembretes:local`), para o cron funcionar mesmo logo
  depois de um `db:test`.
- Cada teste cria o próprio usuário com e-mail único (`e2e-<projeto>-<id>@example.com`) e o remove no
  final; nenhum estado é compartilhado, então os testes rodam em paralelo.
- Até 4 navegadores ao mesmo tempo (2 no CI): eles dividem a máquina com o Supabase local (Docker) e,
  com 8, a primeira navegação de uma página nova chegou a levar 28 s. Tempo máximo de 60 s por teste:
  no WebKit do Windows os cenários longos levam de 30 a 35 s. Sem novas tentativas (`retries: 0`).

### Cenários

| Arquivo | O que verifica |
|---|---|
| `auth.spec.ts` | Criar conta → primeiro acesso → confirmar expediente → Início com "Sua agenda está livre"; sair e entrar de novo. Recuperação de senha pelo e-mail (Mailpit): pedir link, abrir, definir nova senha, a antiga deixa de valer e a nova entra. |
| `agendamento.spec.ts` | Novo agendamento pelo "+" com serviço favorito; aparece na Agenda (dia) e no Início como próximo; detalhes mostram o horário digitado (mesmo com o navegador em Lisboa); concluir, editar dados, voltar para agendado, remarcar para outro dia, cancelar com motivo e reativar; o banco termina com um registro, no novo horário. |
| `conflito.spec.ts` | Com 14:00–15:00 ocupado, tentar 14:30 mostra quem ocupa e os 3 horários livres mais próximos; escolher uma sugestão salva. |
| `conexao.spec.ts` | Sem internet ao salvar: "Sem conexão. Nada foi salvo — tente novamente.", campos preservados, nada no banco; com a internet de volta, "Tentar novamente" grava **uma** vez. Também o caso em que o banco grava mas a resposta se perde: o retry reconhece o próprio agendamento (RN17) e o banco fica com um registro. |
| `notificacoes.spec.ts` | iPhone sem instalar: Ajustes › Notificações mostra o guia de 3 passos, nenhum "Ativar neste aparelho" e "Enviar notificação de teste" desabilitado. Computador: antecedência "1 hora" e "Ocultar nome" gravam no perfil e a prévia mostra `Atendimento às 14:00 · em 1 hora`. `/instalar` sem login abre sem rolagem horizontal nos três projetos. Lembrete de ponta a ponta (só no Node, uma vez): aparelho com endpoint `https://push.invalid/...` e atendimento cujo aviso cai na próxima virada de minuto; espera (até 120 s) o cron chamar a função pelo pg_net e a resposta 200 `{due ≥ 1, failed ≥ 1}` aparecer em `net._http_response` (consulta pela CLI, `supabase db query --local`), e confere que a reserva foi liberada e o aparelho continua cadastrado. A reserva dura poucos milissegundos (envio falha na hora), por isso o sinal é a resposta guardada pelo pg_net; com o cron parado, a URL errada ou o segredo trocado, o teste falha. |
| `pwa.spec.ts` | Projeto `pwa` (service worker liberado): manifesto instalável; service worker ativo sem respostas do Supabase no cache; sem internet, recarregar abre a casca do app com "Sem conexão." (sem e com sessão, com "Tentar novamente"). |
| `responsivo.spec.ts` | Navegação inferior no celular e barra lateral no computador; nenhuma página com rolagem horizontal (`/`, `/agenda`, `/historico`, `/ajustes`, com nome de 120 caracteres); títulos na fonte da marca; barra "Confirmar remarcação" fora da navegação; interruptores do expediente (Ajustes e primeiro acesso) com área de toque ≥ 44×44 px que não encosta nos horários; painel de detalhes em 390 px com rótulos de ação inteiros; `/instalar` em 390 px com abas e "Voltar" ≥ 44 px. |
| `capturas.spec.ts` | Opcional (pulado por padrão): capturas de tela para revisão visual. |

### Violações de CSP

A fixture `page` (`tests/e2e/support/fixtures.ts`) escuta o console do navegador e, no fim do teste,
falha se alguma mensagem contiver `Content Security Policy` ou `Refused to` — é assim que o Chromium e
o WebKit avisam que bloquearam um script, uma conexão, uma fonte ou um frame pela CSP. O erro
`violações de CSP no console do navegador` lista as mensagens, por exemplo:

```text
[error] Connecting to 'https://example.com/' violates the following Content Security Policy directive: "connect-src 'self' http://127.0.0.1:44321 ws://127.0.0.1:44321". The action has been blocked.
[error] Refused to load https://challenges.cloudflare.com/turnstile/v0/api.js because it does not appear in the script-src directive of the Content Security Policy.
```

Para investigar:

- Ver a política em uso: `dist/_headers` (gerada por `scripts/gerar-headers.mjs`) ou
  `curl -I http://localhost:5174/` com o preview no ar.
- Ver as mensagens no próprio navegador: `npm run e2e:ui` (aba _Console_) ou o _trace_ do teste que
  falhou (`npx playwright show-trace <arquivo>.zip`).
- Corrigir a origem do problema (ex.: um recurso embutido em `data:` ou um script de outro domínio),
  não afrouxar a política. Mudanças na CSP passam por `scripts/gerar-headers.mjs` e pelos testes em
  `scripts/gerar-headers.test.ts`.

O servidor de desenvolvimento (`npm run dev`) não envia esses cabeçalhos: a CSP quebraria o recarregamento
automático do Vite. Para ver o app com a CSP: `npm run build && npm run preview`.

### Capturas de tela para revisão

```bash
E2E_CAPTURAS=1 npx playwright test tests/e2e/capturas.spec.ts
```

No PowerShell: `$env:E2E_CAPTURAS='1'; npx playwright test tests/e2e/capturas.spec.ts`.

Gera, com dados realistas (vários status, nome de 120 caracteres), as telas Entrar, Início, Agenda
(dia; semana e mês no computador; lista no celular), Novo agendamento com conflito, Detalhes,
Remarcar, Histórico, Ajustes (perfil, expediente, notificações), 404 e Primeiro acesso, em
`.superpowers/sdd/2026-10-30-plano-02-interface/screens/<projeto>/` (fora do git), para
`chromium-desktop` e `webkit-iphone`.

## Conferências manuais

O que o e2e não cobre e vale olhar a cada versão:

- Safari de verdade em um iPhone (o WebKit do Playwright no Windows não é o Safari do iOS): seletor
  nativo de data/hora, teclado cobrindo campos na gaveta, área segura (notch e barra de gestos).
- Gaveta arrastando para fechar (gesto de toque) no celular.
- Leitor de tela (VoiceOver/TalkBack) nas telas de agenda e no formulário.
- E-mails reais de recuperação de senha fora do ambiente local (SMTP de produção, Plano 04).
- Instalação e lembretes em aparelhos reais (iPhone, Android, APK, Mac, Windows):
  [`checklist-aparelhos.md`](checklist-aparelhos.md).
