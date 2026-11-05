# Guia: gerar o APK Android (TWA com Bubblewrap)

O APK é só uma "casca" que abre o app web (o mesmo `https://<dominio>`) em tela cheia, sem barra de endereço. Todo o conteúdo continua vindo do site; por isso o APK só precisa ser gerado de novo quando a casca muda (veja o fim do guia).

Nada aqui gera chave ou APK dentro do repositório. Os valores `__DOMINIO__` e `__PACOTE__` de `android/twa-manifest.template.json` são preenchidos por você.

## 1. Pré-requisitos

- **Domínio com HTTPS em produção**, com o app publicado e o `manifest.webmanifest` acessível.
- **Verificação de desenvolvedor do Google**: desde set/2026, no Brasil, distribuir um APK fora da Play Store exige que o desenvolvedor esteja verificado pelo Google. Faça a verificação antes de divulgar o arquivo.
- **JDK e Android SDK**: o Bubblewrap oferece baixar os dois na primeira execução (aceite). Precisa de Node.js, que o projeto já usa.
- Instalar o Bubblewrap: `npm install -g @bubblewrap/cli`.
- Os comandos deste guia foram escritos sem rodar o Bubblewrap de verdade: ao gerar o APK, confira cada um contra `bubblewrap --help` (e `bubblewrap <comando> --help`) da versão instalada e corrija o guia se algo tiver mudado.

## 2. Gerar o projeto Android

Em uma pasta de trabalho (por exemplo `android/`, onde `app/` e `build/` já são ignorados pelo git):

```
bubblewrap init --manifest https://<dominio>/manifest.webmanifest
```

O assistente lê o manifesto do app. Use `android/twa-manifest.template.json` como referência dos valores: nome "Agenda em Ordem", nome na tela inicial "Agenda", cor do tema `#0F2D5B`, fundo `#F8FAFC`, `startUrl` `/` e **notificações ligadas** (`enableNotifications: true`). Escolha o ID do pacote (por exemplo `br.com.suaempresa.agenda`) e **anote-o**: ele não muda depois.

Se preferir, copie o modelo para `android/twa-manifest.json`, troque `__DOMINIO__` (só o domínio, sem `https://`) e `__PACOTE__`, e rode `bubblewrap init` a partir dele.

## 3. Keystore (chave de assinatura)

O `bubblewrap init` pergunta se deve criar uma chave. Aceite e escolha uma senha forte.

- O arquivo (`*.keystore` / `*.jks`) **nunca entra no repositório** (já está no `.gitignore`).
- Guarde-o **fora do projeto, com backup** (gerenciador de senhas e uma cópia em outro lugar), junto com o alias e as senhas.
- **Perder a chave = não conseguir mais atualizar o app** para quem já instalou: seria preciso publicar um app novo.

## 4. Gerar o APK

```
bubblewrap build
```

Saem `app-release-signed.apk` (para instalar) e o pacote `.aab` (para a Play Store).

## 5. Impressão digital SHA-256 e `assetlinks.json`

Obtenha a impressão SHA-256 do certificado:

```
bubblewrap fingerprint list
```

(ou `keytool -list -v -keystore <arquivo> -alias <alias>`). Ela tem o formato `AA:BB:...` com 32 pares em maiúsculas. Se distribuir também pela Play Store, inclua a impressão da chave de assinatura do Google Play (separe por vírgula).

O site precisa publicar `https://<dominio>/.well-known/assetlinks.json`. Duas formas:

- **No build do site** (recomendado): defina as variáveis no ambiente de build e rode `npm run build`:

  ```
  ANDROID_PACKAGE_ID=<pacote>
  ANDROID_CERT_SHA256=<impressao>[,<outra>]
  ```

  Com as duas definidas, `dist/.well-known/assetlinks.json` é gerado. Sem elas, o arquivo simplesmente não existe e o build segue normal.

- **À mão**: `node scripts/gerar-assetlinks.mjs saida.json` (usa as mesmas variáveis). Valida o pacote e as impressões e mostra erro em português se algo estiver errado.

Depois, publique o site e confira que o endereço acima responde com o JSON.

No plano gratuito, o endereço `https://<projeto>.pages.dev` do Cloudflare Pages serve para o `assetlinks.json`: use esse mesmo domínio (sem domínio próprio) como `<dominio>` aqui e no `bubblewrap init`. Se um dia trocar de endereço, gere o APK de novo. Veja [`publicacao.md`](publicacao.md).

## 6. Testar

Instale o APK em um Android. Se o app abre **sem barra de endereço**, a verificação deu certo. Se aparecer uma barra no topo, o `assetlinks.json` não foi encontrado ou o pacote/impressão não conferem: revise as variáveis, publique de novo e reinstale.

## 7. Notificações no APK

As notificações usam o mesmo Web Push do site: o TWA delega ao Chrome (`enableNotifications: true`). O profissional ativa os lembretes dentro do app, como no navegador. Não há configuração extra de push no Android.

## 8. Página de download

Hospede o APK (por exemplo em um armazenamento de arquivos seu) e defina `VITE_APK_DOWNLOAD_URL` no build do site. Com ela definida, a página `/instalar` mostra o botão "Baixar o APK"; sem ela, o botão não aparece. Só defina `VITE_APK_DOWNLOAD_URL` depois da verificação de desenvolvedor do Google: antes disso o Android pode bloquear o APK ou mostrar um aviso.

## 9. Quando gerar um APK novo

- **Não precisa** quando só o app web muda (telas, correções, textos): o APK abre sempre a versão publicada.
- **Precisa** quando muda a casca: ícone, nome, cores do tema, domínio ou uma exigência nova do Android/Play. Aumente a versão e gere com `bubblewrap build`, **assinando com o mesmo keystore**.
