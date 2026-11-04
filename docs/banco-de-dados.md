# Banco de dados

Banco PostgreSQL do Supabase. Toda escrita de agendamentos passa por funções (RPC) que validam as regras; o navegador só lê. As regras de negócio (RN01–RN20) estão em `docs/superpowers/specs/2026-10-29-agenda-em-ordem-requisitos.md`.

## Entidades

| Tabela | Finalidade | Colunas principais |
|---|---|---|
| `profiles` | Perfil e preferências do profissional (1:1 com `auth.users`, criado por trigger no cadastro) | `id`, `display_name` (1–80), `business_name`, `timezone` (padrão `America/Sao_Paulo`), `default_duration_minutes` (5–480), `slot_interval_minutes` (15/30/60), `week_starts_on` (0–6), `default_view` (dia/semana/mes/lista), `reminder_minutes` (15/30/60 ou nulo), `hide_client_name_in_notifications` |
| `business_hours` | Turnos de expediente; o almoço é o intervalo entre dois turnos | `owner_id`, `weekday` (0 = domingo … 6 = sábado), `start_time`, `end_time` |
| `favorite_services` | Serviços favoritos (atalhos) | `owner_id`, `name` (1–80), `duration_minutes` (5–480), `color` (`#RRGGBB`), `is_active` |
| `appointments` | Atendimentos | `owner_id`, `client_name`, `client_phone`, `service_name`, `starts_at`, `ends_at`, `status`, `notes`, `cancellation_reason`, `canceled_at`, `reminder_anchor_at`, `created_at`, `updated_at` |
| `appointment_history` | Histórico imutável, gravado por trigger | `appointment_id`, `owner_id`, `actor_id`, `action` (criado/editado/remarcado/status_alterado/cancelado/reativado), `previous_values`, `new_values`, `created_at` |
| `push_subscriptions` | Assinaturas Web Push (um dispositivo por linha); gravadas só por `register_push_subscription`; índice em `owner_id` | `owner_id`, `endpoint` (único, https), `p256dh`, `auth`, `device_label`, `last_used_at` |
| `appointment_reminders` | Controle de lembretes já enviados (evita duplicar) | `appointment_id`, `starts_at`, `sent_at` — só o service role acessa |

Todos os instantes são `timestamptz`. O fuso do perfil é a fonte de verdade para decidir "dia" e "expediente".

## Constraints e regras

| Regra | Onde é garantida | RN |
|---|---|---|
| Sem sobreposição entre agendamentos ativos do mesmo dono: `EXCLUDE USING gist (owner_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE (status <> 'cancelado')` | constraint `appointments_no_overlap` (vale também sob concorrência) | RN01, RN02, RN03, RN07, RN08 |
| Intervalo semiaberto `[)`: terminar às 15:00 permite começar às 15:00 | `tstzrange(..., '[)')` | RN04 |
| Cancelados não bloqueiam horário; concluídos e faltas continuam ocupando | cláusula `WHERE (status <> 'cancelado')` | RN05, RN06 |
| Fim posterior ao início; duração máxima de 12 h; precisão de minuto | `CHECK` em `appointments` | RN09, RN10, RN16 |
| Fora do expediente rejeitado (AE002); início no passado exige `p_confirm_past` (AE004) e fica isento do expediente, mas não de conflito | `app_private.assert_valid_slot` nas RPCs | RN11, RN13 |
| Não atravessa a meia-noite no fuso do perfil (AE003) | `app_private.assert_valid_slot` | RN12 |
| Cancelar não apaga o registro; `canceled_at` preenchido se, e somente se, status = `cancelado` | `CHECK` + `cancel_appointment` | RN14 |
| Dono sempre por `auth.uid()`; nenhuma RPC aceita `owner_id`; RLS por dono; outro dono = `AE006` | RLS + funções `SECURITY DEFINER` | RN15, RN19 |
| Nome e serviço aparados, 1–120 caracteres; telefone 8–20 caracteres de `0-9()+ -`; observações ≤ 1000; motivo ≤ 300 | `CHECK` em `appointments` | RN16 |
| Criação, remarcação, edição, status, cancelamento e reativação gravam histórico | trigger em `appointments` | RN20 |
| Expediente: `end_time > start_time`, precisão de minuto, turnos do mesmo dia sem sobreposição | `CHECK` + `EXCLUDE` em `business_hours` | RN11 |

RN17 e RN18 (falha de conexão e mensagem de conflito) são responsabilidade do frontend, que traduz o código de erro abaixo.

## Transições de status

| De | Para | Como |
|---|---|---|
| `agendado` | `concluido`, `nao_compareceu` | `set_appointment_status` |
| `concluido` | `nao_compareceu`, `agendado` | `set_appointment_status` |
| `nao_compareceu` | `concluido`, `agendado` | `set_appointment_status` |
| `agendado` | `cancelado` | `cancel_appointment` |
| `cancelado` | `agendado` | `reactivate_appointment` (revalida conflito) |

Qualquer outra transição responde `AE005`. Um agendamento cancelado não pode ser editado nem alterado por `set_appointment_status`.

## Funções (RPC)

`create_appointment`, `reschedule_appointment`, `update_appointment_details`, `set_appointment_status`, `cancel_appointment`, `reactivate_appointment`, `set_business_hours` e `register_push_subscription`. Todas são `SECURITY DEFINER` com `search_path` vazio e só têm `EXECUTE` para `authenticated` (e `service_role`, inofensivo: sem `auth.uid()` a função responde `42501`).

`update_appointment_details(p_id, p_client_name, p_service_name, p_client_phone, p_notes)` faz substituição completa: os cinco parâmetros são obrigatórios; `null` ou `''` em telefone/observações limpa o campo, e os valores informados são gravados (aparados).

`register_push_subscription(p_endpoint, p_p256dh, p_auth, p_device_label default null)` devolve o id da assinatura. É um upsert por `endpoint` com "claim": se o mesmo navegador/endpoint já pertencia a outra conta, passa a pertencer a quem registrou por último (com as chaves novas), e a conta anterior deixa de vê-lo por RLS. Sem `auth.uid()` responde `42501`; endpoint que não seja `https://` responde `23514`.

### Lembretes (somente `service_role`)

- `appointments.reminder_anchor_at`: quando o horário atual foi marcado. Um trigger `before update` a atualiza quando `starts_at` muda ou o status volta de `cancelado` para `agendado`; nas linhas existentes recebeu `created_at`. Avisos cujo momento já havia passado nesse instante não são enviados.
- `due_reminders(p_now default now())` devolve `appointment_id, owner_id, starts_at, title, body, url` dos lembretes devidos: status `agendado`, `profiles.reminder_minutes` não nulo, `p_now < starts_at <= p_now + 60 min`, momento de aviso (`starts_at - reminder_minutes`) entre `reminder_anchor_at` e `p_now`, sem reserva em `appointment_reminders` para `(id, starts_at)` e dono com ao menos uma assinatura. O texto usa o fuso do perfil (`profiles.timezone`), nunca o da sessão.
- `claim_reminder(p_appointment_id, p_starts_at)` reserva o par e devolve `true` só para quem inseriu e só se o atendimento ainda está `agendado` nesse `starts_at` (no máximo um envio por atendimento e horário).
- `release_reminder(p_appointment_id, p_starts_at)` apaga a reserva (falha temporária: nenhum aparelho recebeu).

Por causa do revoke global de privilégios padrão (`alter default privileges ... revoke execute on functions`), toda função nova, inclusive de extensões instaladas depois (ex.: `pg_net`, `pg_cron`), precisa de `GRANT EXECUTE` explícito para quem deve chamá-la.

## Códigos de erro

O erro chega ao supabase-js em `error.code`; `error.message` traz a chave.

| Código | Chave | Quando |
|---|---|---|
| `AE001` | `horario_indisponivel` | Sobreposição com outro agendamento ativo |
| `AE002` | `fora_do_expediente` | Intervalo não cabe inteiro num turno do dia (início futuro) |
| `AE003` | `atravessa_meia_noite` | Data local de início diferente da de fim |
| `AE004` | `horario_passado_sem_confirmacao` | Início no passado sem `p_confirm_past` |
| `AE005` | `transicao_invalida` | Ação não permitida no status atual |
| `AE006` | `agendamento_nao_encontrado` | Id inexistente ou de outro dono |
| `42501` | `nao_autenticado` | Sem usuário autenticado (e acesso negado por privilégio) |

Além desses, as RPCs podem devolver erros crus `23514` (check violation) e `23502` (not null) na validação de entrada: tamanhos de texto, formato de telefone, segundos no horário, duração maior que 12h, fim antes do início e nulos. O frontend deve mapeá-los para uma mensagem genérica de "dados inválidos" e nunca exibir `details`.

## Privilégios por papel

| Objeto | `anon` | `authenticated` | `service_role` |
|---|---|---|---|
| `appointments`, `appointment_history` | nada | somente `SELECT` (RLS por dono) | acesso total |
| `profiles` | nada | `SELECT` próprio e `UPDATE` de colunas de preferência | total |
| `business_hours` | nada | `SELECT`; escrita via `set_business_hours` | total |
| `favorite_services` | nada | `SELECT`, `DELETE`, `INSERT`/`UPDATE` por coluna (sem `owner_id`) | total |
| `push_subscriptions` | nada | `SELECT` e `DELETE` próprios; escrita só via `register_push_subscription` | total |
| `appointment_reminders` | nada | nada | acesso total |
| RPCs | nada | `EXECUTE` (exceto `due_reminders`, `claim_reminder`, `release_reminder`) | total |
| `due_reminders`, `claim_reminder`, `release_reminder` | nada | nada | `EXECUTE` |

## Como testar

Pré-requisito: Docker em execução e a pilha local de pé (`npm run db:start`).

- `npm run db:test` recria o banco (migrações + seed) e roda os testes pgTAP em `supabase/tests/database`.
- `npm run test:integration` roda os testes via API real (PostgREST + Auth) com `@supabase/supabase-js`: RLS, privilégios e concorrência (RN08). Cada teste cria usuários novos com e-mails únicos, então não exige reset. URL e chaves são lidas em tempo de execução de `npx supabase status -o json`; nunca ficam em arquivo.
- `npm run db:types` regenera `src/types/database.ts` a partir do banco local. Rode depois de qualquer migração e faça commit do arquivo.

Nota sobre portas: a pilha local usa portas deslocadas em +1000 (API 55321, banco 55322, Studio 55323) para conviver com outro projeto Supabase local. Não fixe portas nem chaves no código; consulte `npx supabase status`.
