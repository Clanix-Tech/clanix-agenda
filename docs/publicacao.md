# Publicar o Agenda em Ordem (plano gratuito)

Passo a passo para quem nunca publicou um site. O serviço roda em dois lugares gratuitos: o
**Supabase** (banco, login e funções) e o **Cloudflare Pages** (o site). Nomes de botões e menus dos
painéis mudam com o tempo: quando este guia disser "confira o nome atual no painel", procure o item
mais parecido.

Antes de começar, tenha na máquina: Node e as dependências (`npm install`), o Docker Desktop ligado
(só para o backup) e contas gratuitas no Supabase e no Cloudflare.

> **Cuidados que valem para o guia inteiro**
>
> - Nunca coloque no repositório: senha do banco, `CRON_SECRET`, chave privada VAPID, segredo do
>   Turnstile, senha de e-mail (SMTP) ou chave `service_role`/`sb_secret_*`. Eles ficam em arquivos
>   `*.local` (o git ignora), nos secrets das funções ou no painel dos serviços.
> - Decisão de 2026-11-05: lançar no plano gratuito e migrar para o Pro quando possível. No gratuito
>   não há backup para baixar e o projeto pausa por inatividade; o passo 9 compensa isso.

## 1. Criar o projeto no Supabase

1. Entre em <https://supabase.com>, crie a conta e **ative a autenticação em dois fatores (MFA)** nas
   configurações da conta (confira o nome atual no painel). Esta conta controla todos os dados.
2. Crie um projeto novo no plano gratuito, com a região **South America (São Paulo), `sa-east-1`**.
   Anote a **senha do banco** num gerenciador de senhas.
3. Na página do projeto, anote (o painel mostra em **Connect / API settings**; confira o nome atual):
   - a **URL do projeto** (`https://<ref>.supabase.co`);
   - a **chave publicável** (começa com `sb_publishable_`);
   - o **project ref** (o `<ref>` da URL).

## 2. Ligar o repositório ao projeto e aplicar o banco

Na raiz do repositório:

1. `npx supabase login` (abre o navegador).
2. `npx supabase link --project-ref <ref>`.
3. `npx supabase db push` aplica as migrações.

**Nunca use `--include-seed`.** O seed cria o schema `tests` (dados de teste) e ele não pode ir para o
ambiente hospedado.

> Atenção: estes comandos falam com o projeto **de produção**. O Supabase local do desenvolvimento usa
> portas e comandos próprios (`npm run db:*`) e não é afetado.

## 3. Segredos e funções

1. Gere os 4 valores de produção **sem mexer nas chaves locais** (não use `npm run vapid:gerar`, que
   é só para o desenvolvimento local, e nunca use `--forcar` nesta pasta):
   - Par VAPID: `npx web-push generate-vapid-keys`. Ele mostra na tela a **Public Key** (vira
     `VAPID_PUBLIC_KEY` e, no passo 7, `VITE_VAPID_PUBLIC_KEY`) e a **Private Key** (vira
     `VAPID_PRIVATE_KEY`).
   - `CRON_SECRET`: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
     (43 caracteres; o banco exige 32 ou mais).
   - `VAPID_SUBJECT`: `mailto:` mais o seu e-mail de contato real (pode ser o mesmo de
     `VITE_PRIVACY_CONTACT_EMAIL`).

   **Guarde os 4 valores num gerenciador de senhas** e nunca no repositório: a chave privada e o
   `CRON_SECRET` não podem ser recuperados depois.
2. Grave os segredos nas funções:

   ```
   npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:<seu-email> CRON_SECRET=...
   ```

3. Publique as três funções (`send-reminders`, `send-test-notification` e `delete-account`; todas têm
   `verify_jwt = false` em `supabase/config.toml` e cada uma valida o próprio acesso):

   ```
   npx supabase functions deploy send-reminders send-test-notification delete-account
   ```

> **Atenção: o par de chaves VAPID precisa casar, e a troca tem de ser seguida.** A chave pública nos
> secrets (`VAPID_PUBLIC_KEY`) e a do site (`VITE_VAPID_PUBLIC_KEY`, passo 7) têm de ser **o mesmo
> par**. Grave os secrets e publique o site com a chave pública correspondente **um logo depois do
> outro**. Se ficarem diferentes, todo envio é recusado, cada recusa conta uma falha no aparelho e,
> na 3ª, a assinatura é apagada: todo mundo terá de ativar os lembretes de novo. Mais detalhes em
> [`notificacoes.md`](notificacoes.md), "Trocar as chaves VAPID".

## 4. Ligar os lembretes

No painel do Supabase, abra o **SQL Editor** e rode (com os seus valores):

```sql
select public.set_reminder_config('https://<ref>.supabase.co/functions/v1/send-reminders', '<o mesmo CRON_SECRET>');
```

Se o SQL Editor responder permissão negada ao chamar `set_reminder_config`, pare e peça ajuda.

O SQL Editor **guarda o histórico** das consultas: depois de rodar, apague a consulta salva (que
contém o segredo). Se o segredo vazar, troque nos dois lados (função e `set_reminder_config`). Veja
[`notificacoes.md`](notificacoes.md).

## 5. Configurar o Auth (login e e-mail)

No painel, em **Authentication** (confira os nomes atuais):

1. **URL Configuration**: em **Site URL** e em **Redirect URLs**, coloque o endereço do site
   (`https://<nome-do-projeto>.pages.dev`, que você só terá no passo 7: volte aqui depois). O app
   envia o link de recuperação de senha para `<endereço>/redefinir-senha`; se o painel pedir uma
   lista, inclua também `https://<nome-do-projeto>.pages.dev/redefinir-senha`.
2. **Sign In / Providers › Email**: **confirmação de e-mail ligada** e **tamanho mínimo da senha: 8**.
3. **E-mail (SMTP)**. O e-mail embutido do Supabase tem limite muito baixo e **não serve para
   usuários reais**. Escolha uma opção e configure em **Authentication › SMTP Settings** (confira o
   nome atual):
   - **Opção A, sem domínio e grátis: Gmail com senha de app.** Ative a verificação em duas etapas
     na conta Google, crie uma "senha de app" e use-a como senha SMTP. O servidor, a porta e o
     usuário (o próprio endereço Gmail) **confira na ajuda do Google** ("Enviar e-mail pelo Gmail
     com SMTP" / "Fazer login com senhas de app"). Limite de envios diários baixo, mas suficiente
     para poucos usuários.
   - **Opção B, com domínio próprio: Resend ou Brevo** (planos gratuitos). Verifique o domínio no
     provedor (registros DNS) e copie de lá o servidor, a porta, o usuário e a senha/chave SMTP.
4. **Limites de envio** (Authentication › Rate Limits): mantenha os padrões ou reduza; com SMTP
   próprio o painel deixa ajustar o número de e-mails por hora.
5. **Modelos de e-mail** (Authentication › Email Templates): traduza para pt-BR os de confirmação de
   cadastro e de recuperação de senha, mantendo as variáveis do Supabase (`{{ .ConfirmationURL }}`).

## 6. CAPTCHA (opcional)

1. No painel do Cloudflare, crie um widget **Turnstile** (confira o nome atual no painel) para o
   endereço do site. Você recebe uma **site key** (pública) e uma **secret key** (segredo).
2. A **site key** vai no `.env.production.local` (`VITE_TURNSTILE_SITE_KEY`, passo 7).
3. A **secret key** vai no Supabase, em **Authentication › Attack Protection** (confira o nome atual
   no painel): ligue o CAPTCHA, escolha Turnstile e cole o segredo. Nunca no repositório.

Sem a site key, o app simplesmente não mostra CAPTCHA. Se você ligar o CAPTCHA no Supabase, tem de
publicar o site com a site key, senão ninguém consegue entrar.

## 7. Publicar o site no Cloudflare Pages

1. `npx wrangler login` (abre o navegador; uma vez por máquina).
2. Crie o projeto por upload direto, **com `master` como branch de produção** (a publicação sempre
   vai para o branch configurado em `CF_PAGES_BRANCH`, `master` por padrão):

   ```
   npx wrangler pages project create <nome-do-projeto> --production-branch=master
   ```

   O nome usa minúsculas, números e hífens e vira o endereço `<nome-do-projeto>.pages.dev`.
3. Copie `.env.example` para `.env.production.local` (o git ignora) e preencha:
   - `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (passo 1);
   - `VITE_VAPID_PUBLIC_KEY` (a chave pública do passo 3: **a mesma** dos secrets);
   - `VITE_PRIVACY_CONTROLLER_NAME` e `VITE_PRIVACY_CONTACT_EMAIL` (aparecem em `/privacidade`; veja
     [`privacidade-e-retencao.md`](privacidade-e-retencao.md));
   - `VITE_TURNSTILE_SITE_KEY` (só se usar CAPTCHA) e `VITE_APK_DOWNLOAD_URL` (só se tiver APK);
   - `CF_PAGES_PROJECT=<nome-do-projeto>` e `CF_PAGES_BRANCH=master`.
4. `npm run verificar:producao` confere variáveis, build e bundle (sem segredos). Corrija o que ele
   apontar. O `publicar:site` roda esta verificação sozinho e para se algo estiver errado.
5. `npm run publicar:site`. Ao final, o Cloudflare mostra o endereço. Volte ao passo 5 e confirme a
   Site URL e as Redirect URLs com esse endereço.

## 8. Conferências depois de publicar

Siga o [`checklist-lancamento.md`](checklist-lancamento.md). Em especial:

1. No painel do Supabase, **Security Advisor** e **Performance Advisor** sem alertas críticos.
2. No SQL Editor, rode e **registre o resultado** (esperado, e aceito: pode vir `true`; veja
   [`seguranca.md`](seguranca.md), "Limitações conhecidas"):

   ```sql
   select has_schema_privilege('anon','net','usage'), has_schema_privilege('authenticated','net','usage');
   ```

3. Cabeçalhos de segurança: `curl -I https://<nome-do-projeto>.pages.dev`.

## 9. Manter ativo e ter backup

O gratuito não oferece backup para baixar e pausa o projeto após uns 7 dias quase sem uso. Siga
[`backup-e-restauracao.md`](backup-e-restauracao.md): `npm run backup:producao` toda semana e antes de
cada atualização do banco, a chamada diária ao `ping` (cron-job.org) e **uma restauração de teste num
projeto gratuito reserva** (a restauração no hospedado ainda não foi testada).

## 10. Atualizações futuras

Sempre **faça um backup antes** (`npm run backup:producao`). Depois, conforme o que mudou:

- Banco: `npx supabase db push` (nunca `--include-seed`).
- Funções: `npx supabase functions deploy send-reminders send-test-notification delete-account`.
- Site: `npm run publicar:site`.
- **Só se você alterar as funções**, confira os tipos delas com o Deno antes de publicar. **Não rode `deno check` na raiz do
  repositório**: o `package.json` faz o Deno resolver `npm:openai` pelo `node_modules` e dá um erro
  falso. Copie `supabase/functions` para uma pasta **fora** do repositório e rode, nessa cópia, via
  Docker: `docker run --rm -v "<pasta-da-cópia>:/app" -w /app denoland/deno:2.1.4 deno check <função>/index.ts`
  (uma função por vez; ajuste o caminho do `index.ts` se preciso).
- Se mudar a chave VAPID, siga o aviso do passo 3 (secrets e site, um logo depois do outro).
- Suba também as verificações: `npm audit --omit=dev` sem *high*/*critical*.
