# Checklist em aparelhos reais (instalação e lembretes)

Notificações push não são totalmente testáveis pelo Playwright (design §8, Etapa 10). Este roteiro
é feito à mão, a cada versão que mexa em service worker, notificações, manifesto ou APK, em cinco
aparelhos:

| Sigla | Aparelho | Como o app roda |
|---|---|---|
| **iPhone** | iPhone com iOS 16.4 ou mais novo | Safari › Compartilhar › Adicionar à Tela de Início, aberto pelo ícone |
| **Android** | Android com Chrome | "Instalar app" do Chrome (WebAPK) |
| **APK** | Android | APK próprio (TWA), gerado pelo [guia do APK](guia-apk-android.md) |
| **Mac** | Mac com Safari 16 ou mais novo (macOS 13+) | Safari (aba normal ou "Adicionar ao Dock") |
| **Windows** | Windows com Chrome e Edge | Navegador ou app instalado pelo ícone da barra de endereço |

## Antes de começar

- O app precisa estar publicado em **HTTPS** com os lembretes configurados (veja
  [`notificacoes.md`](notificacoes.md), "Produção"). No `localhost` só o computador local funciona;
  celulares na rede local não recebem push sem HTTPS.
- Confira que o cron responde, no SQL Editor do projeto de produção (a API não expõe essa tabela): `select status_code, content from net._http_response order by id desc limit 3;`
  mostra `200` a cada minuto.
- Uma conta de teste com expediente que cubra o horário do teste, e uma segunda forma de acessar a
  mesma conta (outro aparelho ou navegador) para criar atendimentos enquanto o aparelho testado está
  bloqueado ou depois de sair.
- No celular: notificações do app/navegador permitidas nos ajustes do sistema e modo foco/não
  perturbe desligado.

## Roteiro (repetir em cada aparelho)

1. **Instalar**: siga `/instalar` (iPhone: Compartilhar › Adicionar à Tela de Início; Android:
   "Instalar app"; APK: baixar e instalar o arquivo; computador: ícone de instalar ou "Adicionar ao
   Dock"). O ícone e o nome "Agenda" aparecem na tela inicial/menu.
2. **Entrar**: abra pelo ícone e entre com a conta de teste (no iPhone a sessão do app instalado é
   separada da do Safari: entrar de novo é esperado).
3. **Ativar**: Ajustes › Notificações › "Ativar neste aparelho". O pedido de permissão aparece só
   depois do toque; aceite. A tela passa a "Lembretes ativados neste aparelho".
4. **Receber teste**: "Enviar notificação de teste". A notificação chega em poucos segundos.
5. **Lembrete real**: antecedência **15 min**; crie um atendimento para **daqui a 20 min**. Por volta
   de 5 min depois (até ~1 min de atraso) chega `Lembrete de atendimento` com
   `HH:MM · <nome> — <serviço> · em 15 min`, com o app fechado e a tela bloqueada.
6. **Tocar e abrir os detalhes**: tocar na notificação abre o app nos detalhes desse atendimento.
7. **Ocultar nome**: ligue "Ocultar nome do cliente na tela de bloqueio" e repita o passo 5 com outro
   atendimento. O corpo deve ser só `Atendimento às HH:MM · em 15 min` (sem nome e sem serviço).
8. **Sair**: saia da conta neste aparelho. Pelo outro acesso, crie um atendimento para daqui a 20 min
   e confirme que **este** aparelho não recebe nada (os demais aparelhos ativados recebem).
9. **Só no iPhone — fontes**: títulos em Sora e textos em Inter (pendência do Plano 02: no WebKit
   do Windows as fontes pareciam finas). Compare com a mesma tela no computador; nada deve cair
   para a fonte padrão do sistema.
10. **Tema escuro, sem flash claro**: com o sistema em modo escuro, abra o app (e recarregue): a tela
    não pode piscar clara antes de ficar escura. Repita com o sistema em modo claro e Ajustes ›
    Aparência em "Escuro": o app abre escuro desde o primeiro quadro.
11. **Só no iPhone — barra de status**: com o app instalado (tela cheia), a barra de status (hora,
    bateria) fica legível nos temas claro e escuro, sem faixa de cor errada atrás dela.

## Registro

Marque ✅ (passou), ❌ (falhou: anote o que viu) ou — (não se aplica). Guarde uma cópia preenchida por
versão.

Versão / data: ________ Responsável: ________

| Passo | iPhone | Android | APK | Mac | Windows Chrome | Windows Edge |
|---|---|---|---|---|---|---|
| 1. Instalar | | | | | | |
| 2. Entrar | | | | | | |
| 3. Ativar | | | | | | |
| 4. Receber teste | | | | | | |
| 5. Lembrete real (20 min, antecedência 15) | | | | | | |
| 6. Tocar abre os detalhes | | | | | | |
| 7. Ocultar nome | | | | | | |
| 8. Sair: deixou de receber | | | | | | |
| 9. Fontes Sora/Inter | | — | — | — | — | — |
| 10. Tema escuro sem flash claro | | | | | | |
| 11. Barra de status legível | | — | — | — | — | — |

## Se algo falhar

- Nada chega em nenhum aparelho: confira `net._http_response` (código diferente de 200, ou
  nenhuma linha nova) e os logs da função `send-reminders` no painel; veja
  [`notificacoes.md`](notificacoes.md).
- Chega o teste mas não o lembrete: confira a antecedência, o status (só Agendado) e se o atendimento
  foi criado antes do momento do aviso (aviso que já tinha passado na criação não é enviado).
- iPhone sem o botão "Ativar": o app foi aberto pelo Safari, não pelo ícone da Tela de Início.
- "Notificações bloqueadas neste navegador": libere nos ajustes do sistema/navegador e volte à tela.
