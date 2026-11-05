# Checklist de lançamento

Marque cada caixa no site **publicado** (`https://<nome-do-projeto>.pages.dev`), com uma conta de
teste. Passo a passo da publicação: [`publicacao.md`](publicacao.md). Mapa de segurança:
[`seguranca.md`](seguranca.md).

## Publicação e banco

- [ ] Security Advisor e Performance Advisor do painel do Supabase sem alertas críticos.
- [ ] No SQL Editor: `select has_schema_privilege('anon','net','usage'), has_schema_privilege('authenticated','net','usage');` rodado e o resultado registrado aqui: ____________ (risco aceito, veja `seguranca.md`).
- [ ] Cabeçalhos presentes: `curl -I https://<nome-do-projeto>.pages.dev` mostra `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy` e os demais gerados por `scripts/gerar-headers.mjs`.
- [ ] Cron dos lembretes responde `200` a cada minuto (`select status_code, content from net._http_response order by id desc limit 3;`).

## Conta e e-mail

- [ ] Cadastro: o e-mail de confirmação chega (confira também fora da caixa de spam) e o link abre o app.
- [ ] Entrar antes de confirmar o e-mail mostra o aviso.
- [ ] Login funcionando com o **CAPTCHA real do Turnstile** (se ligado). O caminho de sucesso com o Turnstile real não foi testado localmente.
- [ ] Cadastro com o CAPTCHA real.
- [ ] Recuperar senha com o CAPTCHA real: o e-mail chega e o link abre `/redefinir-senha`, onde dá para criar a nova senha.
- [ ] Excluir a conta pela tela (Ajustes › Conta e privacidade) funciona e impede de entrar de novo.

## Privacidade

- [ ] `/privacidade` abre sem login e mostra o nome e o e-mail do responsável (não a mensagem "Contato do responsável ainda não informado.").
- [ ] Exportar os dados em CSV funciona (Ajustes › Conta e privacidade).

## Aparelhos

- [ ] Roteiro completo de [`checklist-aparelhos.md`](checklist-aparelhos.md), incluindo o **lembrete real** no iPhone com o app instalado e no Android.

## Backup e continuidade

- [ ] Backup feito (`npm run backup:producao`) e guardado fora do repositório e fora de nuvem sem criptografia.
- [ ] **Restauração testada** num projeto gratuito reserva ([`backup-e-restauracao.md`](backup-e-restauracao.md)); contagens conferidas.
- [ ] Chamada diária ao `ping` configurada (cron-job.org) e respondendo `200` com `"ok"`.
- [ ] E-mail da conta do Supabase monitorado (aviso de pausa por inatividade).
