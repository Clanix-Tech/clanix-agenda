# Notificações (lembretes antes do atendimento)

O profissional recebe, em cada aparelho em que ativou, um aviso antes de cada atendimento
**Agendado**. Este documento explica o caminho do lembrete, como configurar localmente e em
produção, os limites e o que acontece com os dados. Detalhes do banco (funções, Vault, cron) estão
em [`banco-de-dados.md`](banco-de-dados.md); detalhes da pilha local, em
[`supabase-local.md`](supabase-local.md).

## Como funciona

```
pg_cron (job "send-reminders", a cada minuto)
  └─ app_private.invoke_send_reminders()        lê URL e segredo do Vault
       └─ pg_net: POST .../functions/v1/send-reminders   (header x-cron-secret)
            └─ Edge Function send-reminders
                 ├─ due_reminders(agora)         quem avisar agora; texto já no fuso do perfil
                 ├─ claim_reminder               reserva: no máximo 1 aviso por atendimento + horário
                 ├─ Web Push (chaves VAPID)  ──► serviço de push do navegador/sistema ──► aparelho
                 └─ release_reminder             devolve a reserva se nenhum aparelho recebeu
                                                 (falha temporária: tenta de novo no minuto seguinte)
                    aparelho respondeu 404/410 → a assinatura é apagada
```

Regras (design §6.2):

- Antecedência em Ajustes › Notificações: Desligado, 15 min, 30 min (padrão) ou 1 hora.
- Só atendimentos com status Agendado. Cancelado não avisa; remarcado avisa pelo novo horário; um
  aviso cujo momento já tinha passado quando o horário foi marcado (ex.: marcado para daqui a 10 min
  com antecedência 30) não é enviado.
- Texto: título `Lembrete de atendimento`; corpo `14:00 · Juliana Rocha — Escova e hidratação · em
  30 min` (nome cortado em 60 caracteres; 60 min aparece como `em 1 hora`). Com "Ocultar nome do
  cliente na tela de bloqueio": `Atendimento às 14:00 · em 30 min` (sem nome e sem serviço).
- Tocar na notificação abre os detalhes do atendimento (`/?atendimento=<id>`).
- Cada aparelho é ativado em Ajustes › Notificações › "Ativar neste aparelho" (a permissão só é
  pedida nesse clique). "Enviar notificação de teste" manda um aviso para os aparelhos ativados.
  No iPhone, Web Push só funciona com o app instalado na Tela de Início (iOS 16.4 ou mais novo): sem
  instalar, a tela mostra o guia de instalação em vez do botão.
- Ao sair da conta, a assinatura deste aparelho é apagada. Se outra conta entrar no mesmo navegador
  sem a anterior ter saído (ex.: sessão expirada), a assinatura da conta anterior é cancelada neste
  navegador: os lembretes dela deixam de chegar aqui.

## Configuração local

1. `npm run vapid:gerar` — grava `supabase/functions/.env` (ignorado pelo git) com
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` e `CRON_SECRET`, e imprime a linha
   `VITE_VAPID_PUBLIC_KEY=...`.
2. Copie essa linha para o `.env.local`.
3. Reinicie a pilha deste projeto (`npx supabase stop` e `npx supabase start`) para o edge runtime
   ler o `.env`.
4. `npm run lembretes:local` — grava no Vault local a URL da função e o `CRON_SECRET`. Repita depois
   de cada `npm run db:reset`/`npm run db:test` (o reset apaga o Vault). O `npm run e2e` faz isso
   sozinho no início quando `supabase/functions/.env` existe.
5. Push de verdade só no build: `npm run build && npm run preview` (no `npm run dev` não há service
   worker e a tela mostra "Este navegador não recebe notificações.").

Para conferir o cron e a URL que o banco alcança, veja "Edge Functions e lembretes" em
[`supabase-local.md`](supabase-local.md).

## Produção

1. **Chaves e segredo** (uma vez; nunca versione):
   - par VAPID: `npx web-push generate-vapid-keys`;
   - `CRON_SECRET` com 32 caracteres ou mais, ex.:
     `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
2. **Secrets das Edge Functions** (painel do Supabase › Edge Functions › Secrets, ou CLI):

   ```
   npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:<contato-real> CRON_SECRET=...
   ```

   `VAPID_SUBJECT` é um `mailto:` ou URL de contato real do responsável (os serviços de push o usam
   para avisar sobre problemas). `SUPABASE_URL` e a chave de serviço já vêm do próprio Supabase.
3. **Publicar as funções**: `npx supabase functions deploy send-reminders` e
   `npx supabase functions deploy send-test-notification` (o `verify_jwt` de cada uma vem de
   `supabase/config.toml`: desligado na `send-reminders`, que é chamada pelo cron com o segredo).
4. **Ligar o cron**: no SQL Editor,
   `select public.set_reminder_config('https://<ref>.supabase.co/functions/v1/send-reminders', '<mesmo CRON_SECRET>');`
   (veja [`banco-de-dados.md`](banco-de-dados.md)). O SQL Editor guarda o histórico das consultas:
   apague a consulta salva depois de rodar `set_reminder_config`. Se o segredo vazar, troque nos dois
   lados: o Vault (com `set_reminder_config`) e o secret da função `CRON_SECRET`.
5. **Frontend**: `VITE_VAPID_PUBLIC_KEY` no build, com o mesmo valor de `VAPID_PUBLIC_KEY`.
6. **Conferir**: `select status_code, content from net._http_response order by id desc limit 3;`
   deve mostrar `200` a cada minuto. Depois, siga o [checklist de aparelhos](checklist-aparelhos.md).

Trocar o `CRON_SECRET` exige atualizar os dois lados (secret da função e `set_reminder_config`).

## Trocar as chaves VAPID

**Quando trocar:** só se a chave privada vazar ou por política de segurança. Não é rotina.

**Comandos:**

- Local: `npm run vapid:gerar -- --forcar` (grava chaves novas em `supabase/functions/.env`) e reinicie o Supabase local.
- Produção: gere o par com `npx web-push generate-vapid-keys`, rode
  `npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=...`, coloque a chave pública nova
  em `VITE_VAPID_PUBLIC_KEY` e publique o site de novo.

**Atenção:** grave os secrets e publique o site com a chave pública correspondente **um logo depois do
outro**, e o par (`VAPID_PUBLIC_KEY` nos secrets e `VITE_VAPID_PUBLIC_KEY` no build) tem de casar. Se
ficarem diferentes, todo envio é recusado, cada recusa conta uma falha e, na 3ª, a assinatura de cada
aparelho é apagada. O passo a passo completo está em [`publicacao.md`](publicacao.md).

**O que acontece:**

- Quem abrir o app com os lembretes ativados é reinscrito sozinho na chave nova (o app compara a
  chave da inscrição com a do build).
- Quem não abrir o app: o serviço de push recusa os envios (400/401/403), cada recusa conta uma
  falha no aparelho e, na 3ª, a assinatura é apagada. Essas pessoas precisam ativar de novo em
  Ajustes › Notificações.

## Limites

- **Atraso de até ~1 minuto**: o cron roda a cada minuto. O lembrete é "aproximado", aceitável para
  avisos de 15 a 60 min.
- **Entrega depende do sistema**: modo foco/não perturbe, economia de bateria, notificações do app
  desligadas nos ajustes do sistema ou navegador fechado (no computador) podem atrasar ou esconder o
  aviso. O app só garante que o pedido saiu para o serviço de push.
- **iPhone**: só com o app instalado na Tela de Início; a sessão do app instalado é separada da do
  Safari (é preciso entrar de novo depois de instalar).
- **Falha temporária** (aparelho ou serviço de push fora do ar): a reserva é devolvida e o envio é
  tentado de novo a cada minuto até a hora do atendimento. Assinatura expirada (404/410) é apagada;
  o aparelho precisa ser ativado de novo. Recusa permanente (400/401/403) conta uma falha no
  aparelho; na 3ª seguida a assinatura é apagada. Um envio bem-sucedido zera a contagem.
- Mais de um aparelho: todos os ativados recebem; basta um receber para o lembrete contar como enviado.

## Privacidade

- Só o profissional dono da agenda recebe lembretes; clientes nunca recebem nada.
- O texto vai cifrado de ponta a ponta (Web Push) até o aparelho; o serviço de push (Apple, Google,
  Mozilla, Microsoft) não lê o conteúdo. Mesmo assim, ele aparece na tela de bloqueio: por isso a
  opção "Ocultar nome do cliente na tela de bloqueio", que tira nome e serviço do texto.
- Os registros (logs) das funções não têm nome de cliente nem texto do lembrete.
- O service worker não guarda respostas do Supabase em cache, e nenhum dado de cliente vai para o
  armazenamento do navegador.
- Chave privada VAPID, `CRON_SECRET` e chave de serviço ficam só nos secrets das funções e no Vault
  do banco, nunca no app nem no repositório.

## Testes

- Automáticos: veja [`guia-de-testes.md`](guia-de-testes.md) (pgTAP das regras, testes da função
  com Vitest, integração com a função local e e2e do caminho cron → pg_net → função → banco).
- Em aparelhos reais (push não é testável pelo Playwright):
  [`checklist-aparelhos.md`](checklist-aparelhos.md).
