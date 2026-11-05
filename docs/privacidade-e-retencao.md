# Privacidade e retenção: orientações para quem opera o serviço

Complementa a Política de Privacidade pública (`/privacidade`). Se algo aqui mudar na prática,
atualize a política e a data `PRIVACY_UPDATED_AT` em `src/features/legal/privacyInfo.ts`.

## Quem é quem

- O **profissional** (usuário do app) é o controlador dos dados dos seus clientes.
- Quem opera o serviço atua como **operador** desses dados e como controlador dos dados de conta
  do profissional.
- Defina `VITE_PRIVACY_CONTROLLER_NAME` e `VITE_PRIVACY_CONTACT_EMAIL` antes de publicar. Sem eles,
  a página mostra "Contato do responsável ainda não informado." (veja `docs/publicacao.md`).

## Atender um pedido de titular

1. **Cliente final** (pessoa atendida pelo profissional) pede acesso, correção ou exclusão:
   oriente a falar com o profissional, que é quem responde pelos dados. Não altere nem apague
   dados de cliente a pedido de terceiros sem confirmar com o profissional.
2. **Profissional** pede algo sobre os próprios dados:
   - Acesso/cópia: Ajustes › Conta e privacidade › "Baixar meus dados (CSV)".
   - Correção: no próprio app.
   - Exclusão: Ajustes › Conta e privacidade › "Excluir minha conta" (tira os dados do app na
     hora, sem volta; das cópias de segurança, em cerca de 30 dias).
   - Se a pessoa não conseguir usar o app, atenda pelo e-mail de contato, confirmando a
     identidade pelo e-mail da conta, e responda em até 15 dias.

## Retenção

- Dados ficam enquanto a conta existir. A exclusão pelo app remove tudo do app na hora, por
  cascata: conta, clientes, atendimentos, histórico e aparelhos com lembretes.
- **Cópias de segurança (dumps) são mantidas por cerca de 30 dias** (decisão D4). Para isso valer:
  - rode `npm run backup:producao` **pelo menos uma vez por semana**: é nessa execução que os
    arquivos com mais de 30 dias da pasta de backup são apagados;
  - apague **à mão** as cópias guardadas em outros lugares (disco externo, pasta criptografada)
    com mais de 30 dias, pelo menos uma vez por mês.
  Assim, dados excluídos somem dos backups em cerca de 30 dias, como diz a política.
- Os dumps também contêm registros internos do login (`auth`), com e-mails, endereços IP e dados
  do navegador das sessões. Valem os mesmos cuidados e o mesmo prazo.

## Registros técnicos (logs)

- **Os logs do nosso código** (Edge Functions e banco) só têm ids e códigos, nunca nome de
  cliente, telefone, observações ou e-mail.
- **Os provedores guardam registros próprios**, por prazos definidos por eles e fora do nosso
  controle: o Supabase (acessos à API e ao banco, com endereço IP e o endereço acessado, e o
  registro de eventos de login, com e-mail e IP) e o Cloudflare (acessos ao site, com IP e a
  página acessada). Uma busca no histórico, por exemplo, vai no endereço acessado e pode levar o
  nome de um cliente. A Política de Privacidade diz isso de forma simples.
- **Registro de auditoria do Auth:** no painel do projeto, em **Authentication** (procure algo como
  "Audit logs"; confira o nome atual no painel), veja se os eventos de login são gravados também
  numa tabela do próprio banco (`auth.audit_log_entries`). Se sim, eles entram nos backups e ficam
  até alguém apagar; se a opção existir, prefira desligar a gravação no banco e deixar só os logs
  do provedor (que expiram sozinhos). Anote aqui o que encontrou: ____________.

## Cuidados com backups

- **Nunca** copie dumps para nuvem pessoal (Drive, Dropbox, e-mail etc.) sem criptografia.
- Guarde-os criptografados, com acesso restrito, e não os coloque no repositório.
- **Limite da restauração:** um backup não sabe quais contas foram excluídas depois dele. Se você
  restaurar, as contas excluídas depois da data do backup **voltam**. Para evitar isso:
  1. Mantenha uma lista **privada, fora do repositório** (no mesmo gerenciador de senhas ou pasta
     criptografada dos backups), com o id da conta e a data, sempre que souber de uma exclusão
     (pedido por e-mail, aviso da pessoa ou ao conferir o banco). O id fica em Authentication ›
     Users no painel; anote só o id e a data, não o e-mail.
  2. Depois de qualquer restauração, apague de novo cada conta da lista com data posterior ao
     backup: no painel do Supabase, em Authentication › Users, exclua o usuário (o banco apaga os
     dados dele em cascata, como na exclusão pelo app).
  3. A exclusão pelo próprio app não avisa o operador; exclusões que você não ficou sabendo não
     entram na lista. Isso é uma limitação aceita: por isso a restauração é só para desastre.

## Em caso de incidente de segurança

1. Contenha: revogue as chaves expostas (service role, VAPID, chaves de API) e troque os
   segredos (`CRON_SECRET`, segredo do Turnstile, senha do banco, SMTP).
2. Se houver suspeita de acesso indevido, encerre as sessões e, se preciso, pause o serviço.
3. Levante o que foi afetado (quais dados, quantas pessoas, desde quando).
4. Avise as pessoas afetadas, em linguagem simples, e a ANPD quando o incidente puder trazer
   risco ou dano relevante (prazo de referência: 3 dias úteis).
5. Registre o que aconteceu e o que foi feito, sem copiar dados pessoais para o registro.

Esta orientação não substitui aconselhamento jurídico.
