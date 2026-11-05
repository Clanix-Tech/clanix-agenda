# Mapa de segurança

Cada requisito de segurança e privacidade (requisitos §15 e §16), onde é garantido e o teste que o
prova. Como rodar os testes: [`guia-de-testes.md`](guia-de-testes.md).

| Requisito | Onde é garantido | Teste que prova |
| --- | --- | --- |
| RLS em todas as tabelas expostas | Migrações em `supabase/migrations` (`enable row level security`) | pgTAP `08_invariants.test.sql`: "toda tabela de public tem RLS habilitado" |
| Grants mínimos; `anon` sem acesso | Revoke global de privilégios padrão e `grant` explícito por objeto | `08_invariants`: "anon não tem privilégio em nenhuma tabela de public"; "nenhuma função de public/app_private ... executável por anon (exceto ping)"; `rls-api.test.ts`: "anônimo não lê dados nem executa RPCs" |
| Isolamento entre contas (ler, editar, excluir, alterar propriedade) | Políticas RLS por `auth.uid()` | `rls-api.test.ts`: "usuário B não enxerga nem altera agendamentos do usuário A"; pgTAP `01_profiles` ("A enxerga só o próprio perfil", "update no perfil de B afeta 0 linhas", "id não é atualizável"), `05_rpc_create_reschedule` ("B não remarca agendamento de A"), `07_notifications` ("B não enxerga assinaturas de A", "B não apagou assinatura de A") |
| `owner_id` nunca vem do navegador | Escrita só por RPC `SECURITY DEFINER` que usa `auth.uid()` | `rls-api.test.ts`: "escrita direta em appointments é negada mesmo para o dono (só via RPC)"; `05_rpc_create_reschedule`: "cria agendamento agendado com owner = auth.uid()"; `07_notifications`: "insert direto com owner_id explícito negado", "update de owner_id negado" |
| Funções `SECURITY DEFINER` com `search_path` fixo | Todas com `set search_path = ''` | `08_invariants`: "toda função SECURITY DEFINER de public/app_private fixa search_path vazio" |
| Conflito de horários não burlável | Restrição de exclusão no banco + RPCs | pgTAP `04_appointments_constraints` (RN03 a RN06); `concurrency.test.ts`: "RN08: 10 reservas simultâneas do mesmo horário resultam em exatamente 1 sucesso" |
| Dados de auditoria imutáveis | Sem `update`/`delete` no histórico para `authenticated` | pgTAP `04_appointments_constraints`: "authenticated não atualiza histórico", "authenticated não apaga histórico" |
| Limites de tamanho e formato dos campos | `check` nas tabelas e esquemas Zod no app | pgTAP `04_appointments_constraints`: "nome com 121 caracteres rejeitado", "telefone com HTML rejeitado"; `01_profiles`: "display_name de 81 chars é cortado em 80" |
| XSS | React escapa texto; nenhum `dangerouslySetInnerHTML` em `src`; CSP | CSP presente no build usado pelo e2e (`tests/e2e/global-setup.ts` recusa servidor sem `Content-Security-Policy`); `scripts/gerar-headers.test.ts` (política completa) |
| CSP e cabeçalhos de segurança | `scripts/gerar-headers.mjs` gera `dist/_headers` no build (Cloudflare Pages) | `scripts/gerar-headers.test.ts` ("gera a política completa, na ordem combinada"); conferência real com `curl -I` no [checklist](checklist-lancamento.md) |
| Segredos fora do bundle e do repositório | `scripts/verificar-producao.mjs` (lista de variáveis `VITE_` permitidas, procura segredos no `dist/`); `*.local` ignorados pelo git | `scripts/verificar-producao.test.ts`: "chave secreta (sb_secret_) no lugar da publicável é problema", "JWT legado com role service_role é problema", "variável VITE_ fora da lista permitida é problema", "lista os arquivos (também em subpastas) com segredos" |
| TLS/HTTPS | Cloudflare Pages e Supabase (HTTPS obrigatório) | `verificar-producao.test.ts`: "URL do Supabase em http:// é problema" |
| CAPTCHA (opcional) | Widget Turnstile no app; segredo no Auth do Supabase | `Login.test.tsx`, `Signup.test.tsx`, `ForgotPassword.test.tsx` ("com CAPTCHA e token: envia captchaToken...", "com CAPTCHA sem token: bloqueia o envio"); só "sem token → captcha_failed" foi verificado no Auth local. **O caminho de sucesso com o Turnstile real não pôde ser testado localmente**: confira em produção pelo [checklist](checklist-lancamento.md) |
| Limites do Auth (abuso de login/cadastro) | Limites nativos do Supabase Auth, SMTP próprio, confirmação de e-mail | `Login.test.tsx`: "limite de tentativas (429)"; configuração no painel (passo 5 de [`publicacao.md`](publicacao.md)), conferida no checklist |
| Exclusão de conta | Edge Function `delete-account`: só o `sub` do token verificado, senha recente (300 s), cascata no banco | `delete-account/handler.test.ts` ("senha há 301 s → 403 e nada é apagado", "senha há 10 s → 204 e apaga o id do token, ignorando user_id do corpo"); `delete-account.test.ts` (integração): "apaga só a conta de quem chama e tudo que é dela"; `01_profiles`: "excluir usuário remove o perfil"; `07_notifications`: "excluir usuário remove suas assinaturas"; e2e `excluir-conta.spec.ts` |
| Exportação dos dados | CSV gerado no navegador de consulta já filtrada pelo RLS; células `= + - @` neutralizadas | `src/lib/csv.test.ts`: "usa BOM, ; e aspas duplicadas, e neutraliza fórmula"; `exportCsv.test.ts` |
| Política de privacidade e retenção | Rota `/privacidade`; [`privacidade-e-retencao.md`](privacidade-e-retencao.md) | `PrivacyPage.test.tsx` |
| Logs sem dados pessoais | Eventos só com ids e códigos (`errorKind`, `evento`, `aparelho`, `atendimento`) | Revisão de `grep -rn "console\." supabase/functions` (abaixo); `send-reminders.test.ts` (integração) |
| Nada de analytics ou publicidade | Nenhuma dependência nem script de análise; CSP só libera Supabase (e Turnstile, se houver) | Revisão: `grep -ril "analytics\|gtag\|sentry" src package.json` sem resultados; `gerar-headers.test.ts` ("sem Turnstile: Supabase (https e wss) no connect-src e nenhum frame") |
| Funções de backend só para `service_role` | `grant execute` explícito | `09_reminders`/`11_producao` (ex.: `record_push_results` negada a quem não é `service_role`); `08_invariants`: "nenhuma função de app_private executável por authenticated" |
| Autorização das Edge Functions | `verify_jwt = false` com validação no próprio handler (JWT do usuário ou `x-cron-secret`, comparação em tempo constante) | `send-reminders.test.ts`, `send-test-notification.test.ts`, `delete-account.test.ts` (integração): casos sem token e com token inválido retornam 401 |
| Dependências atualizadas | `npm audit` | `npm audit --omit=dev`: 0 vulnerabilidades em 2026-11-05 |

## Verificações feitas

- **Logs das Edge Functions** (`grep -rn "console\." supabase/functions`, 2026-11-05): os 7 pontos de
  log gravam só nome de evento, id de atendimento ou de aparelho, status HTTP e tipo de erro. Nenhum
  loga nome, telefone, observações, e-mail, endpoint de push ou texto do lembrete.
- **Dependências**: `npm audit --omit=dev` encontrou 0 vulnerabilidades. Repita antes de cada versão.

## Limitações conhecidas

- **Schema `net` (`pg_net`)**: as migrações revogam `usage` e demais privilégios de `public`, `anon` e
  `authenticated` no schema `net`, mas isso **não tem efeito**: o schema pertence a `supabase_admin`
  (no Supabase local e no hospedado) e o papel das migrações não consegue revogar. Os testes pgTAP
  correspondentes são pulados nesses casos. O risco residual é **aceito**: a API (PostgREST) não
  expõe `net` (só `public` e `graphql_public`), então `anon` e `authenticated` não o alcançam pela
  API. Depois de publicar, rode a consulta do passo 8 de [`publicacao.md`](publicacao.md) e
  registre o resultado.
- **Restauração de backup no hospedado**: só foi ensaiada no banco local
  ([`backup-e-restauracao.md`](backup-e-restauracao.md)).
- **CAPTCHA real**: veja a linha da tabela acima.
