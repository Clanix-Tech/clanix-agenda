# Agenda em Ordem — Documento de Design do MVP

- **Data:** 29/10/2026
- **Status:** aprovado pelo responsável pelo produto em 29/10/2026
- **Requisitos completos:** [`2026-10-29-agenda-em-ordem-requisitos.md`](2026-10-29-agenda-em-ordem-requisitos.md) (briefing original, seções 1–24). Este documento **não repete** os requisitos; registra as decisões tomadas depois do briefing, a arquitetura e o que fica para quem constrói. Onde houver diferença, este documento prevalece.
- **Guia de marca:** `Guia de Marca Agenda em Ordem.png` (raiz do repositório).
- **Explorações visuais:** canvas "Agenda em Ordem — Direções de Tela" (https://claude.ai/artifact/WF88ue3z7mitG9XeqGyvjz), 5 direções × celular/computador.

Legenda: **[Usuário]** = decidido pelo responsável pelo produto · **[Claude]** = decisão técnica minha, pode ser revista.

---

## 1. Intenção

Substituir a agenda de papel de profissionais autônomos de beleza e estética (manicures, cabeleireiros, barbeiros, designers de sobrancelha etc.) por uma agenda digital **simples**, que funcione igual no celular e no computador, sincronizada online, e que **avise o profissional antes de cada atendimento**.

Muitos dos clientes-alvo (os profissionais) usam **iPhone e Mac**; o produto tem que funcionar bem no Safari/iOS tanto quanto no Android e no Windows. **[Usuário]**

Sucesso = o profissional cria a conta, instala o app no celular, marca um atendimento em segundos, recebe o lembrete e nunca reserva dois clientes no mesmo horário.

## 2. Objetivos, não-objetivos e anti-objetivos

**Objetivos do MVP**
- Tudo dos critérios de aceitação do briefing (seção 23).
- **PWA instalável** em iPhone, Android, Mac e Windows. **[Usuário]**
- **Lembrete por notificação push** antes de cada atendimento, no celular e no computador. **[Usuário]**
- **Android em duas formas:** instalação pelo Chrome (WebAPK) **e** um **APK próprio** que o responsável distribui diretamente aos profissionais (link/WhatsApp), fora da Play Store. **[Usuário]**

**Não-objetivos (fora do MVP)**
- Publicação na App Store e na Google Play — fica para uma fase futura, sem data. **[Usuário]** O código deve continuar empacotável (ex.: Capacitor) sem retrabalho.
- Resumo diário por notificação. **[Usuário — não aceito por ora]**
- Tudo que o briefing já exclui: cadastro de clientes, contas de clientes, agendamento público, pagamentos, caixa, estoque, preços, comissões, ERP.
- Sincronização offline com fila de alterações.

**Anti-objetivos (seria fracasso mesmo funcionando)**
- Virar um sistema "de salão" cheio de módulos; qualquer tela que pareça ERP está errada.
- Notificar ou expor dados de clientes finais (eles não têm conta e não recebem nada).
- Mostrar "salvo" quando não salvou (RN17).
- Dados de um profissional visíveis a outro, por qualquer caminho (API, CSV, push, cache).

## 3. Restrições

- Stack fixada pelo briefing (seção 2). Versões estáveis do momento da implementação, conferidas na documentação oficial.
- Português do Brasil, DD/MM/AAAA, 24 h, fuso do perfil (padrão `America/Sao_Paulo`) como fonte de verdade.
- LGPD: minimização, sem analytics/publicidade com dados de clientes, sem dados pessoais em logs.
- Nenhum segredo no frontend nem no repositório; chave publicável do Supabase só com RLS.
- iOS: Web Push só funciona com o PWA **instalado na Tela de Início** (iOS/iPadOS 16.4+), e a permissão só pode ser pedida a partir de um gesto do usuário.
- Brasil, Android: pelo cronograma anunciado pelo Google, a partir de setembro/2026 apps instalados fora da Play Store em aparelhos certificados precisam ser de **desenvolvedor verificado**. O APK próprio depende dessa verificação (ver §9 e §11).

## 4. Abordagens consideradas

### 4.1 Distribuição e notificações

| Abordagem | Trade-off | Resultado |
|---|---|---|
| **A. PWA + Web Push; APK Android via TWA (Bubblewrap); lojas depois** | Um código só, sem taxas de loja, atualização instantânea. iPhone exige instalação manual pelo Safari. APK exige chave de assinatura, `assetlinks.json` e verificação de desenvolvedor Google. | **Escolhida [Usuário]** |
| B. PWA + Capacitor nas lojas já no MVP | Presença na App Store/Play, push nativo. Custa US$ 99/ano (Apple) + US$ 25 (Google), exige Mac/Xcode ou build em nuvem, risco de rejeição na Apple (diretriz 4.2). | Adiada para fase futura |
| C. React Native / Flutter | App nativo "de verdade". Reescreve todo o frontend e foge da stack do briefing. | Descartada |

### 4.2 Direção visual

Cinco direções foram desenhadas (Clássica, Linha do Tempo, Painel em Blocos, Cabeçalho Marinho, Minimalista). **Escolhida: "3 · Painel em Blocos", celular e computador. [Usuário]**

## 5. Design de interface

### 5.1 Direção "Painel em Blocos"
- **Computador:** barra lateral estreita (~96 px) só de ícones com rótulo curto (Início, Agenda, Histórico, Ajustes), botão "+" de novo agendamento no topo dela, avatar no rodapé. Conteúdo em blocos/cartões brancos com borda `#E2E8F0` e raio ~18 px sobre fundo `#F8FAFC`. Cabeçalho da página com saudação/título, data, busca e botão "Novo agendamento".
- **Dashboard (computador):** 4 indicadores em blocos (hoje, próximo — bloco azul-marinho em destaque, semana, cancelamentos do mês), tabela "Próximos atendimentos" com ações Ver/Remarcar, coluna lateral com minicalendário do mês e "Horários livres hoje" (botões tracejados que abrem o novo agendamento já preenchido).
- **Celular:** saudação + data, cartão azul-marinho grande do próximo atendimento (Ver detalhes / Remarcar), 3 indicadores em blocos, horários livres de hoje, lista de próximos atendimentos. Navegação inferior com 4 destinos e botão central circular "+" destacado.
- As telas ainda não desenhadas (Agenda dia/semana/mês/lista, Novo agendamento, Detalhes, Remarcação, Histórico e busca, Configurações, Notificações, Login, 404) serão **desenhadas nesse mesmo estilo e mostradas ao usuário antes de serem implementadas** (Etapa 03). **[Claude]**

### 5.2 Tokens e acessibilidade
- Paleta e tipografia do briefing; tokens centralizados (CSS variables + tema Tailwind).
- **Botões primários usam `#2563EB`** em vez de `#3B82F6`: branco sobre `#3B82F6` tem contraste ~3,7:1 (reprova AA para texto normal); `#2563EB` dá ~5,2:1. `#3B82F6` segue em ícones, logo, destaques e elementos grandes. **[Claude]**
- Status sempre com **ícone + texto + cor**: Agendado (azul, relógio), Concluído (verde, check), Não compareceu (âmbar, pessoa-x), Cancelado (cinza, x, nome riscado).
- Alvos de toque ≥ 44 px; drawers no celular no lugar de modais.

## 6. Arquitetura

### 6.1 Visão geral
- **Frontend:** SPA React + Vite (estrutura de pastas do briefing §21), servida como arquivos estáticos via HTTPS.
- **Backend:** Supabase (Postgres + Auth + Edge Functions + pg_cron/pg_net).
- **Escrita de agendamentos só por funções no banco (RPC)**; o navegador **não** tem `INSERT/UPDATE/DELETE` direto em `appointments` nem acesso de escrita a `appointment_history`. Leitura via RLS (`owner_id = auth.uid()`). **[Claude]**
  - `create_appointment`, `update_appointment_details` (cliente, telefone, serviço, observações), `reschedule_appointment` (data, horário e/ou duração), `set_appointment_status` (concluído / não compareceu / correção de volta para agendado), `cancel_appointment(motivo opcional)`, `reactivate_appointment`.
  - As funções obtêm o dono por `auth.uid()` — nunca de parâmetro (briefing §15).
  - Histórico gravado por **trigger** na mesma transação (atomicidade da remarcação, RN20); `appointment_history` é somente leitura para o dono.
- **Edição e mudanças de status [Usuário]** — complementa o briefing §11 e o critério "editar e remarcar" (§23). Toda ação abaixo grava `appointment_history` com valores anteriores e novos.

  | Ação | Permitida quando o status é | Regras |
  |---|---|---|
  | Editar cliente, telefone, serviço, observações | Agendado, Concluído, Não compareceu | Correção de dados; não mexe no horário |
  | Mudar data, horário ou duração | Agendado | É uma **remarcação**: valida conflito e expediente; histórico como remarcação |
  | Cancelar (motivo opcional) | Agendado | Não apaga o registro |
  | Reativar | Cancelado → Agendado | Revalida disponibilidade e expediente |
  | Marcar concluído / não compareceu | Agendado | — |
  | Corrigir status marcado por engano | Concluído ↔ Não compareceu; Concluído ou Não compareceu → Agendado | Não altera o intervalo, portanto não gera conflito |

  Cancelado não pode ser editado nem remarcado (precisa ser reativado antes). Concluído e Não compareceu não podem ser cancelados nem remarcados.
- **Conflitos (RN01–RN08, RN19):** restrição de exclusão `EXCLUDE USING gist (owner_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE (status <> 'cancelado')` com `btree_gist`. Violação vira um erro de domínio traduzido no frontend para mensagem clara + escolher outro horário (RN18). Reativar um cancelado passa pela mesma restrição.
- **Expediente (RN11, RN12):** validado na função/trigger no banco convertendo o intervalo para o fuso do perfil: o atendimento precisa caber **inteiro dentro de um único turno** de `business_hours` do dia da semana e não atravessar a meia-noite. **Almoço = intervalo entre dois turnos do mesmo dia** (não há tabela separada de pausas). **[Claude]** Alterar o expediente depois não invalida atendimentos existentes; a regra vale na criação, remarcação e reativação. **[Claude]**
- **Expediente inicial [Usuário]:** no primeiro acesso, uma etapa rápida "Seu expediente" já preenchida com **segunda a sexta, 09:00–12:00 e 13:00–18:00** (almoço 12:00–13:00); o profissional confirma ou ajusta antes de usar a agenda. Sem expediente salvo, a agenda direciona para essa etapa em vez de falhar.
- **Horário passado (RN13):** a função recebe `confirm_past boolean`; sem ele, rejeita início no passado. O status inicial continua "Agendado" (briefing §11); a interface oferece "Marcar como concluído" logo em seguida. **[Claude]**
- **Exceção à RN11 para registros passados [Usuário]:** atendimentos com início no passado (criados com `confirm_past`, ex.: transcrição da agenda de papel) **não** precisam caber no expediente atual. Continuam sujeitos ao bloqueio de conflito (RN01–RN06), à proibição de atravessar a meia-noite (RN12) e às demais validações.
- **Integridade no banco:** `CHECK` de status (enum), `ends_at > starts_at`, limites de tamanho (nome, telefone, serviço, observações, motivo), `owner_id` imutável.

### 6.2 Notificações (lembrete antes do atendimento)

**Comportamento [Usuário + detalhes Claude]**
- Destinatário: **só o profissional**, em **todos os dispositivos** em que ativou notificações.
- Antecedência configurável: desligado / 15 / 30 / 60 min; **padrão 30 min**.
- Texto: "14:00 · Juliana Rocha — Escova e hidratação · em 30 min". Toque abre os detalhes do atendimento.
- Opção de privacidade **"Ocultar nome do cliente na tela de bloqueio"** → "Atendimento às 14:00". **[Claude, aceito]**
- Só atendimentos com status **Agendado**. Cancelou → não avisa. Remarcou → o aviso segue o novo horário. Lembrete cujo horário já passou na criação (ex.: atendimento daqui a 10 min com antecedência 30) não é enviado. **[Claude]**

**Implementação [Claude]**
- **Web Push com chaves VAPID** (padrão aberto; funciona em Safari iOS/macOS, Chrome, Edge, Firefox e no APK TWA).
- Tabela `push_subscriptions` (id, owner_id, endpoint único, p256dh, auth, rótulo do dispositivo, criado/último uso) com RLS por dono.
- Preferências no `profiles`: `reminder_minutes` (nulo = desligado) e `hide_client_name_in_notifications`.
- Tabela `appointment_reminders` (appointment_id, starts_at do envio, enviado_em) para **não enviar duas vezes** e reenviar após remarcação (chave = atendimento + horário).
- **pg_cron a cada minuto** chama (via pg_net) a Edge Function `send-reminders`, que seleciona os atendimentos devidos, monta a mensagem no fuso do perfil, envia o push e **remove assinaturas expiradas** (HTTP 404/410). Chave privada VAPID só nos secrets da Edge Function.
- Service worker com estratégia **injectManifest** do vite-plugin-pwa (handlers próprios de `push` e `notificationclick`).
- **Tela "Notificações"** em Configurações: estado neste dispositivo, botão "Ativar neste dispositivo" (pedido de permissão só por clique), "Enviar notificação de teste", antecedência, opção de privacidade.
- **iPhone sem o app instalado:** em vez do botão de ativar, um guia curto: Compartilhar → "Adicionar à Tela de Início" → abrir pelo ícone → ativar.

### 6.3 PWA e conectividade
- Manifest completo (nome, ícones maskable e Apple touch icon, cores de tema, splash), `display: standalone`.
- Service worker faz cache **somente de arquivos estáticos do build**. Respostas do Supabase/API **nunca** vão para cache (privacidade, briefing §17). **[Claude]**
- Aviso de nova versão com botão "Atualizar" (modo `prompt`).
- Indicador de conexão; mutações não entram em fila offline: falha → mensagem clara + "Tentar novamente", formulário mantém o que foi digitado **em memória** (sem gravar dados pessoais em localStorage). **[Claude]**
- Observação iOS: a sessão do app instalado é separada da do Safari; o usuário fará login de novo após instalar. Documentar no guia de instalação.

### 6.4 Android: WebAPK e APK próprio
- **Chrome:** instalação pelo botão "Instalar app"; o Chrome gera o WebAPK automaticamente. Nenhum trabalho extra além do manifest.
- **APK próprio (TWA via Bubblewrap):** **[Claude: ferramenta]**
  - Usa o mesmo PWA publicado; a interface atualiza sozinha pelo site, então **um APK novo só é necessário quando muda a "casca"** (ícone, nome, pacote, versão mínima).
  - Requer: domínio HTTPS de produção, `/.well-known/assetlinks.json` com a impressão digital da chave, **keystore de assinatura guardado fora do repositório** (perder = não conseguir mais atualizar), identificador do pacote.
  - Notificações no APK chegam pelo mesmo Web Push (delegação de notificações do TWA).
  - Distribuição: página de download no próprio site com instruções de "instalar apps desconhecidos".
  - Script/documentação para gerar o APK em `docs/` (guia passo a passo). A geração depende da verificação de desenvolvedor Google (§11).

### 6.5 Segurança (complementos ao briefing §15)
- Funções `SECURITY DEFINER` com `search_path` fixo e checagem de `auth.uid()`; `REVOKE` explícito de privilégios padrão; grants mínimos por tabela.
- **CSV:** gerado no navegador a partir de consulta já filtrada pelo RLS; células que começam com `= + - @` são neutralizadas (injeção de fórmula). **[Claude]**
- Exclusão de conta: Edge Function autenticada que apaga o usuário no Auth e, em cascata, todos os dados dele (inclusive assinaturas push).
- Proteção contra abuso no login/cadastro: limites nativos do Supabase Auth; CAPTCHA opcional (Cloudflare Turnstile ou hCaptcha) se houver chave — documentar, não inventar.
- Testes de RLS/permissão exigidos no briefing + os mesmos para `push_subscriptions` e `appointment_reminders`.

## 7. Telas

As 9 do briefing (§19) + **Primeiro acesso: "Seu expediente"** + **Notificações** (dentro de Configurações) + **Guia de instalação** (iPhone/Android, incluindo página de download do APK). Todas no estilo Painel em Blocos.

## 8. Etapas

Seguem as 10 etapas do briefing (§22), com estes acréscimos.

**Duas frentes em paralelo [Claude]:** enquanto as telas da Etapa 03 são desenhadas e aprovadas pelo usuário (na conversa, com mockups no canvas), a frente de banco avança (Etapa 02 de fundação e Etapa 04: migrações, RLS, funções de agendamento, testes SQL e de concorrência), pois não depende do visual. A interface só é implementada depois da aprovação das telas.
- **Etapa 03:** desenhar as telas restantes no estilo escolhido e obter o OK do usuário antes de implementar a interface.
- **Etapa 04:** incluir `push_subscriptions`, `appointment_reminders` e preferências de notificação nas migrações e nos testes de RLS.
- **Etapa 09 — PWA, notificações e APK:** service worker com push, Edge Function `send-reminders` + pg_cron, tela de Notificações, guia de instalação iOS/Android, configuração TWA/Bubblewrap e `assetlinks.json`, guia de geração do APK.
- **Etapa 10:** checklist manual em aparelhos reais (iPhone instalado, Android Chrome, APK, Mac Safari, Windows Chrome/Edge) para instalação e recebimento de lembretes — notificações push não são totalmente testáveis por Playwright.

Ao fim de cada etapa: o que foi feito, arquivos, testes executados e resultados, pendências e próximos passos (briefing §24).

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Profissional no iPhone não instala o PWA e não recebe lembretes | Guia de instalação dentro do app; banner discreto no Safari iOS; tela de Notificações mostra o estado real |
| Verificação de desenvolvedor Android bloqueia instalação do APK no Brasil | WebAPK pelo Chrome funciona sem isso; APK próprio só é distribuído após a verificação |
| Perda do keystore do APK | Guardar fora do repo com backup; documentado |
| Atraso de até ~1 min nos lembretes (cron por minuto) e entrega dependente do sistema operacional | Aceitável para lembrete de 15–60 min; comunicado como "aproximado" |
| Calendário (FullCalendar) pouco amigável no celular | Visão diária do celular em cartões próprios; FullCalendar nas visões de computador ou equivalente, conforme briefing |
| Fuso/horário de verão | Fuso do perfil no banco; conversões com biblioteca de fusos; testes de fuso |

## 10. O que fica com quem constrói

- Escolha exata de bibliotecas auxiliares (ex.: `date-fns-tz` vs. API `Intl`; biblioteca de Web Push compatível com Deno), sempre conferindo a documentação.
- Usar FullCalendar ou componentes próprios em cada visão, desde que a visão diária do celular siga o estilo de cartões.
- Nomes de funções, colunas novas e estrutura interna das pastas, respeitando o briefing.
- Hospedagem estática do frontend (qualquer uma com HTTPS e suporte a SPA), se o usuário não tiver preferência.

## 11. Pendências do usuário (credenciais e serviços externos)

**Plano de serviços [Usuário]:** desenvolvimento no Supabase gratuito (e localmente via Supabase CLI + Docker); **lançamento no Supabase Pro** (backups diários; o plano gratuito não tem backup utilizável e pausa projetos inativos); **provedor de e-mail transacional** (ex.: Resend ou Brevo, plano gratuito no início) configurado como SMTP do Supabase Auth antes do lançamento, com confirmação de e-mail ativada.

**Nota (decisão de 2026-11-05): lançar no plano gratuito e migrar para o Pro quando possível.** Fica valendo, no gratuito, o que compensa a falta de backup e a pausa por inatividade (Plano 04, Task 8): `npm run backup:producao` (semanal e antes de cada `db push`, retenção de 30 dias), chamada diária à função `ping` por um agendador externo gratuito e restauração de teste num projeto reserva (`docs/backup-e-restauracao.md`). O e-mail pode usar Gmail com senha de app (sem domínio) ou um provedor com domínio próprio; o site pode ficar no endereço `*.pages.dev` do Cloudflare Pages (`docs/publicacao.md`).

Sem inventar valores; o projeto avança no que não depender deles.
1. **Projeto Supabase** (URL e chave publicável; secrets das Edge Functions configurados pelo painel/CLI); upgrade para Pro antes do lançamento.
2. **Domínio de produção com HTTPS** (necessário para PWA em produção, push e `assetlinks.json`).
3. **Verificação de desenvolvedor Android (Google)** e o **identificador do pacote** do APK (ex.: `br.com.<dominio>.agenda`).
4. **Conta no provedor de e-mail** e domínio de envio verificado (antes do lançamento).
5. Opcional: chave de CAPTCHA (Turnstile ou hCaptcha).
