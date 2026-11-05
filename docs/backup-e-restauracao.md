# Backup, restauração e projeto sempre ativo

O plano gratuito do Supabase **não oferece backups para baixar** e **pausa o projeto** depois de uns 7 dias com pouquíssima atividade. Este guia cobre as duas coisas.

## 1. Fazer o backup

### Antes da primeira vez

1. Deixe o Docker Desktop ligado (a ferramenta do Supabase usa o Docker para gerar o backup).
2. Pegue a URL de conexão do banco: na página do projeto no Supabase, em **Connect / Database settings** (confira o nome atual no painel). Use a conexão que funcione na sua rede (a "Session pooler" costuma funcionar em qualquer rede). A URL contém a **senha do banco**: trate como segredo.
3. Crie, na raiz do projeto, o arquivo `.env.backup.local` (o git ignora este arquivo) com uma linha:

   ```
   SUPABASE_DB_URL=postgresql://postgres.<ref>:<SENHA>@<servidor>:5432/postgres
   ```

   Se a senha tiver caracteres especiais (`@`, `/`, `:`, `#`, `%`), troque-os pelo código com `%` (ex.: `@` vira `%40`).
4. Opcional: `AGENDA_BACKUP_DIR` define a pasta dos backups. Sem ela, vai para `Backups/agenda-em-ordem` dentro da sua pasta de usuário. O script **recusa** pastas dentro do repositório.

### Rodar

```
npm run backup:producao
```

Gera três arquivos, com data e hora (`AAAA-MM-DD_HHmm-`):

| Arquivo | Conteúdo |
| --- | --- |
| `...-roles.sql` | configurações dos papéis do banco |
| `...-schema.sql` | estrutura: tabelas, funções, regras de acesso |
| `...-data.sql` | os dados (clientes, atendimentos, perfis e também os usuários do `auth`) |

O comando imprime só os nomes dos arquivos, nunca a URL. Arquivos com mais de **30 dias** na pasta são apagados automaticamente, **mas só quando o backup roda**: a limpeza acontece a cada execução.

O backup **não** leva: o histórico de migrações (`supabase_migrations`), as tarefas agendadas do `pg_cron` nem os segredos do Vault (URL e segredo do cron dos lembretes). Eles são recriados na restauração (seção 2). Ele **leva**, além dos dados do app, os registros internos do login (`auth`), que incluem e-mails, endereços IP e dados do navegador das sessões.

### Rotina obrigatória

- **Pelo menos uma vez por semana.** É isso que garante que dados excluídos somem das cópias em cerca de 30 dias, como diz a Política de Privacidade.
- **Antes de cada `npx supabase db push`** (mudança no banco de produção).
- **Cópias guardadas em outro lugar** (disco externo, pasta criptografada): o script não alcança. Apague à mão as que tiverem mais de 30 dias, pelo menos uma vez por mês.

### Cuidados

- Os arquivos têm dados de clientes e usuários. **Não** guarde em nuvem pessoal (Drive, Dropbox etc.) sem criptografia; prefira um disco externo ou uma pasta criptografada.
- Nunca coloque os backups, nem a URL do banco, dentro do repositório.

## 2. Restaurar

### Num projeto novo do Supabase (o caso real)

> **Atenção: a restauração num projeto Supabase de verdade ainda não foi testada.** Ela só foi ensaiada no Supabase local (veja "Como isto foi testado"). Ao publicar, faça uma restauração de teste num projeto gratuito reserva, antes de precisar dela de verdade.

A estrutura do banco vem das **migrações do repositório** (que também criam as tarefas do `pg_cron` e o histórico de migrações); do backup vêm só os **dados**. O arquivo `schema.sql` serve de consulta (para comparar a estrutura), mas não é usado nesta sequência. Faça tudo na ordem:

1. **Crie o projeto novo** (passo 1 de [`publicacao.md`](publicacao.md)). Use o repositório na mesma versão que estava publicada quando o backup foi feito (as mesmas migrações).
2. **Aplique a estrutura antes dos dados**: passo 2 de [`publicacao.md`](publicacao.md) (`npx supabase link --project-ref <ref-novo>` e `npx supabase db push`, **nunca** com `--include-seed`).
3. **Carregue os dados** (precisa do `psql`; `DESTINO` é a URL de conexão do projeto novo, que contém a senha):

   ```
   psql "$DESTINO" -f 2026-11-05_1437-data.sql
   ```

   O arquivo já começa com `SET session_replication_role = replica`, que desliga gatilhos e checagens de chave estrangeira só durante a carga (sem isso, criar o usuário criaria um perfil vazio e o perfil do backup daria conflito). O arquivo `roles` só repete os limites de tempo padrão dos papéis; num projeto novo pode ser ignorado.

   **Erros esperados e inofensivos:** `permission denied` em tabelas internas do `storage` (no ensaio: `buckets_vectors` e `vector_indexes`, que estavam vazias). Qualquer erro em tabela `public.*` ou `auth.users`/`auth.identities` **não** é esperado: pare e investigue.
4. **Refaça os passos 3 a 7 de [`publicacao.md`](publicacao.md)**, porque nada disso está no backup:
   - passo 3: secrets das funções (`npx supabase secrets set ...`, com o **mesmo** par VAPID de antes, para os aparelhos continuarem inscritos) e `npx supabase functions deploy ...`;
   - passo 4: `select public.set_reminder_config(...)` com a URL do projeto **novo** (os segredos do Vault não vêm no backup; sem isso o cron roda mas não envia nada);
   - passo 5: configurações do Auth (Site URL, Redirect URLs, SMTP, modelos de e-mail);
   - passo 6: CAPTCHA, se usar;
   - passo 7: troque `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` no `.env.production.local` pelos do projeto **novo** e publique o site de novo (`npm run publicar:site`). A política de segurança do site (CSP) é gerada a partir dessa URL; publicar sem isso deixa o site falando com o projeto antigo.
5. **Confira** (abaixo). Se o projeto antigo ainda existir, só desligue-o depois de conferir.

### Conferir

1. Compare a contagem nos dois bancos (no SQL Editor de cada um):

   ```sql
   select 'users', count(*) from auth.users
   union all select 'profiles', count(*) from public.profiles
   union all select 'appointments', count(*) from public.appointments
   union all select 'business_hours', count(*) from public.business_hours
   union all select 'push_subscriptions', count(*) from public.push_subscriptions;
   select jobname from cron.job;          -- send-reminders e limpar-historico-cron
   select count(*) from vault.secrets;    -- 2 depois do set_reminder_config
   ```

2. Entre no site publicado com uma conta real (ou de teste) e confira **mais que números**: a agenda mostra os atendimentos, e em Ajustes o nome do negócio, a duração padrão e os **horários de atendimento** estão como antes.
3. Mande uma notificação de teste em Ajustes › Notificações num aparelho que já estava ativado.

### Como isto foi testado

Em 05/11/2026, no Supabase local deste projeto (nunca no projeto hospedado):

- **O que o backup contém (verificado):** um backup feito com `npm run backup:producao` apontado para o banco local não tem `supabase_migrations` (nenhuma ocorrência), não tem linhas de `cron.job` nem de `vault.secrets`; o `data.sql` começa com `SET session_replication_role = replica` e traz `auth.*` (inclusive `audit_log_entries`, com IP) e `public.*`.
- **Ensaio da sequência acima (verificado):** `npx supabase db reset` (banco vazio + migrações, como um projeto novo após o `db push`), depois `data.sql` com `psql` como o usuário `postgres` (sem superusuário, como no hospedado). Únicos erros: `permission denied` em `storage.buckets_vectors` e `storage.vector_indexes` (vazias). Resultado: contagens iguais (`auth.users` 5 = 5, `profiles` 5 = 5, `appointments` 4 = 4, `appointment_history` 5 = 5, `business_hours` 30 = 30) e conteúdo idêntico de `profiles`, `business_hours` e `appointments` (mesmo hash md5). As 2 tarefas do `pg_cron` e as 11 migrações estavam registradas (vieram do `db reset`), e o Vault ficou vazio até rodar a configuração dos lembretes, como esperado.
- **Não verificado:** a restauração num projeto hospedado real, o `db push` num projeto novo, a permissão de `session_replication_role` no hospedado (a documentação do Supabase usa esse mesmo comando na restauração) e os passos 3 a 7 refeitos. Por isso o item "Restauração testada" do [`checklist-lancamento.md`](checklist-lancamento.md) continua obrigatório.

## 3. Manter o projeto ativo

- **O que causa a pausa:** no plano gratuito, o projeto é pausado após cerca de 7 dias com pouquíssima atividade.
- **Aviso:** o Supabase manda um e-mail para o dono da conta antes de pausar. Não ignore esse e-mail.
- **Se pausar:** na página do projeto, use o botão de restaurar/reativar. Só é possível reativar projetos pausados há até **90 dias**; depois disso, só pelo backup deste guia.
- **Uso real já conta:** o uso diário do app (entrar, ver a agenda, criar atendimentos) gera atividade. O risco maior é um período de pouco uso, como férias.
- **Chamada diária gratuita:** configure um serviço de agendamento de chamadas, como o cron-job.org (gratuito), para fazer uma chamada por dia a:

  ```
  POST <SUPABASE_URL>/rest/v1/rpc/ping
  apikey: <chave publicável>
  Content-Type: application/json
  ```

  - `<SUPABASE_URL>` e a chave publicável (a mesma `VITE_SUPABASE_PUBLISHABLE_KEY` do site) estão na página do projeto, em **Connect / API settings** (confira o nome atual no painel).
  - Corpo da chamada: `{}`.
  - A função `public.ping()` só devolve `"ok"` e não mexe em nenhum dado. Resposta `200` com `"ok"` significa que deu certo.
  - Use só a chave **publicável**; nunca a `service_role`/secreta.
