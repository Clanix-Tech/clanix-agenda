# Guia de testes

Quatro camadas de teste, da mais rápida para a mais completa. Todos os comandos rodam na raiz do
repositório.

| Camada | Comando | Precisa do Supabase local? | O que cobre |
|---|---|---|---|
| Unitários | `npm test` | Não | Regras puras (horários, fuso, CSV), componentes e telas com um Supabase falso (Vitest + Testing Library, jsdom). |
| Banco (pgTAP) | `npm run db:test` | Sim | Recria o banco local (`supabase db reset`) e roda os testes SQL de `supabase/tests`: RLS, RPCs, regras de conflito e expediente. |
| Integração | `npm run test:integration` | Sim | Chamadas reais à API local (RLS entre usuários, concorrência na criação de agendamentos). |
| Ponta a ponta | `npm run e2e` | Sim | O app de verdade no navegador (Playwright): computador, iPhone e Android. |

Antes de abrir um PR: `npm run typecheck && npm run lint && npm test && npm run db:test && npm run test:integration && npm run e2e`.

## Pré-requisitos

1. Node e dependências: `npm install`.
2. Docker Desktop em execução.
3. Supabase local deste projeto no ar: `npm run db:start` (detalhes em `docs/supabase-local.md`;
   as portas são as deslocadas, API em `55321` e Mailpit em `55324`).
4. Só para o e2e, os navegadores do Playwright (uma vez por máquina):
   `npx playwright install chromium webkit`.

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

O perfil de todo usuário de teste fica em `America/Sao_Paulo`; as datas e horas dos testes são
calculadas nesse fuso (próximos dias úteis, dentro do expediente seg–sex 09–12 e 13–18), então o
resultado não depende do dia, da hora nem do fuso da máquina.

### Como o ambiente é montado

- `playwright.config.ts` lê `npx supabase status -o json` e sobe o Vite em modo `test` na porta
  `5174` (`vite --mode test --port 5174`), passando só `VITE_SUPABASE_URL` e
  `VITE_SUPABASE_PUBLISHABLE_KEY`. Se já houver um servidor na 5174, ele é reaproveitado (fora do CI).
- `tests/e2e/global-setup.ts` grava `.env.test.local` (ignorado pelo git) com essas duas variáveis
  públicas e guarda a chave secreta **apenas na memória** do processo de teste. A chave secreta nunca
  é escrita em arquivo nem chega ao navegador; ela só é usada no Node para criar usuários (API admin)
  e conferir o banco (ex.: contar agendamentos).
- Cada teste cria o próprio usuário com e-mail único (`e2e-<projeto>-<id>@example.com`) e o remove no
  final; nenhum estado é compartilhado, então os testes rodam em paralelo.
- Até 4 navegadores ao mesmo tempo (2 no CI): o servidor de desenvolvimento do Vite entrega módulos
  soltos e, com mais navegadores, a primeira carga de cada página fica lenta a ponto de estourar o
  tempo dos testes.

### Cenários

| Arquivo | O que verifica |
|---|---|
| `auth.spec.ts` | Criar conta → primeiro acesso → confirmar expediente → Início com "Sua agenda está livre"; sair e entrar de novo. Recuperação de senha pelo e-mail (Mailpit): pedir link, abrir, definir nova senha, a antiga deixa de valer e a nova entra. |
| `agendamento.spec.ts` | Novo agendamento pelo "+" com serviço favorito; aparece na Agenda (dia) e no Início como próximo; detalhes mostram o horário digitado (mesmo com o navegador em Lisboa); concluir, editar dados, voltar para agendado, remarcar para outro dia, cancelar com motivo e reativar; o banco termina com um registro, no novo horário. |
| `conflito.spec.ts` | Com 14:00–15:00 ocupado, tentar 14:30 mostra quem ocupa e os 3 horários livres mais próximos; escolher uma sugestão salva. |
| `conexao.spec.ts` | Sem internet ao salvar: "Sem conexão. Nada foi salvo — tente novamente.", campos preservados, nada no banco; com a internet de volta, "Tentar novamente" grava **uma** vez. Também o caso em que o banco grava mas a resposta se perde: o retry reconhece o próprio agendamento (RN17) e o banco fica com um registro. |
| `responsivo.spec.ts` | Navegação inferior no celular e barra lateral no computador; nenhuma página com rolagem horizontal (`/`, `/agenda`, `/historico`, `/ajustes`, com nome de 120 caracteres); títulos na fonte da marca; barra "Confirmar remarcação" fora da navegação; interruptores do expediente (Ajustes e primeiro acesso) com área de toque ≥ 44×44 px que não encosta nos horários; painel de detalhes em 390 px com rótulos de ação inteiros. |
| `capturas.spec.ts` | Opcional (pulado por padrão): capturas de tela para revisão visual. |

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
