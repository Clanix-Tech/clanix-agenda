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

O comando imprime só os nomes dos arquivos, nunca a URL. Arquivos com mais de **30 dias** na pasta são apagados automaticamente.

### Rotina sugerida

- **Toda semana.**
- **Antes de cada `npx supabase db push`** (mudança no banco de produção).

### Cuidados

- Os arquivos têm dados de clientes e usuários. **Não** guarde em nuvem pessoal (Drive, Dropbox etc.) sem criptografia; prefira um disco externo ou uma pasta criptografada.
- Nunca coloque os backups, nem a URL do banco, dentro do repositório.

## 2. Restaurar

### Num projeto novo do Supabase (o caso real)

Um projeto novo já vem com `auth`, `storage` e as extensões da plataforma. Restaure só o seu conteúdo:

1. Crie o projeto novo e pegue a URL de conexão dele (variável `DESTINO` abaixo).
2. Restaure estrutura e dados, nesta ordem (precisa do `psql`):

   ```
   psql "$DESTINO" -f 2026-11-05_1437-schema.sql
   psql "$DESTINO" -f 2026-11-05_1437-data.sql
   ```

   O arquivo `roles` só é necessário se você mudou limites dos papéis; num projeto novo ele pode ser ignorado.
3. Erros esperados e inofensivos: itens que a plataforma já tem ou que só ela controla (extensões como `pg_cron` já criadas, permissões em tabelas internas do `storage`, o schema `supabase_functions`). O que importa é conferir a contagem (abaixo).
4. As tarefas agendadas (`pg_cron`) e as Edge Functions vêm do repositório, não do backup: reaplique as migrações (`npx supabase db push`) e publique as funções de novo.

### Conferir

Compare a contagem nos dois bancos, por exemplo:

```sql
select count(*) from public.appointments;
select count(*) from auth.users;
```

### Como isto foi testado

O fluxo foi ensaiado de verdade no banco local, em um banco descartável (`restauro_teste`) dentro do contêiner `supabase_db_agenda-em-ordem`:

- A estrutura de `auth`, `storage`, `extensions` e `vault` foi copiada do banco local para simular o projeto novo (que já os tem).
- `schema.sql` e `data.sql` foram aplicados com `psql`. Só houve os erros esperados acima (extensão `pg_cron` só no banco `postgres`, publicação `supabase_realtime`, tabelas internas do `storage`).
- Resultado: `public.appointments` 20 = 20, `auth.users` 25 = 25 e `public.profiles` 25 = 25. O banco descartável foi apagado em seguida.

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
