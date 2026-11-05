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
   - Exclusão: Ajustes › Conta e privacidade › "Excluir minha conta" (imediata e definitiva).
   - Se a pessoa não conseguir usar o app, atenda pelo e-mail de contato, confirmando a
     identidade pelo e-mail da conta, e responda em até 15 dias.

## Retenção

- Dados ficam enquanto a conta existir. A exclusão pelo app remove tudo por cascata: conta,
  clientes, atendimentos, histórico e aparelhos com lembretes.
- **Cópias de segurança (dumps) são mantidas por no máximo 30 dias** (decisão D4). Apague as mais
  antigas; assim, dados excluídos somem dos backups em até 30 dias, como diz a política.
- Registros técnicos (logs) não devem ter dado pessoal: só ids e códigos.

## Cuidados com backups

- **Nunca** copie dumps para nuvem pessoal (Drive, Dropbox, e-mail etc.) sem criptografia.
- Guarde-os criptografados, com acesso restrito, e não os coloque no repositório.
- Ao restaurar um backup, reaplique as exclusões de conta feitas depois da data dele.

## Em caso de incidente de segurança

1. Contenha: revogue as chaves expostas (service role, VAPID, chaves de API) e troque os
   segredos (`CRON_SECRET`, segredo do Turnstile, senha do banco, SMTP).
2. Se houver suspeita de acesso indevido, encerre as sessões e, se preciso, pause o serviço.
3. Levante o que foi afetado (quais dados, quantas pessoas, desde quando).
4. Avise as pessoas afetadas, em linguagem simples, e a ANPD quando o incidente puder trazer
   risco ou dano relevante (prazo de referência: 3 dias úteis).
5. Registre o que aconteceu e o que foi feito, sem copiar dados pessoais para o registro.

Esta orientação não substitui aconselhamento jurídico.
