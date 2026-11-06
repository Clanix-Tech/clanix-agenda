import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { buildAssetLinks, lerFingerprints } from './scripts/gerar-assetlinks.mjs';
import { buildHeaders, headersFor, parseHeaders } from './scripts/gerar-headers.mjs';

// Com ANDROID_PACKAGE_ID e ANDROID_CERT_SHA256 no ambiente, o build publica
// /.well-known/assetlinks.json (verificação do APK/TWA). Sem elas, o arquivo não existe.
function assetLinksPlugin(): Plugin {
  return {
    name: 'agenda-assetlinks',
    apply: 'build',
    generateBundle() {
      const packageId = process.env.ANDROID_PACKAGE_ID;
      const sha256 = lerFingerprints(process.env.ANDROID_CERT_SHA256);
      if (!packageId || sha256.length === 0) return;
      this.emitFile({
        type: 'asset',
        fileName: '.well-known/assetlinks.json',
        source: `${JSON.stringify(buildAssetLinks(packageId, sha256), null, 2)}
`,
      });
    },
  };
}

// Cabeçalhos de segurança (CSP etc.) do site publicado: o build grava dist/_headers (formato do
// Cloudflare Pages) e o `vite preview` aplica esse mesmo arquivo, para os testes ponta a ponta
// rodarem com a CSP de verdade. O servidor de desenvolvimento fica sem: a CSP quebraria o HMR.
function securityHeadersPlugin(): Plugin {
  let env: Record<string, string | undefined> = {};
  return {
    name: 'agenda-security-headers',
    apply: (_config, { command, isPreview }) => command === 'build' || isPreview === true,
    configResolved(config) {
      env = config.env;
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: '_headers',
        source: buildHeaders({
          supabaseUrl: env.VITE_SUPABASE_URL ?? '',
          turnstile: Boolean(env.VITE_TURNSTILE_SITE_KEY?.trim()),
        }),
      });
    },
    configurePreviewServer(server) {
      const { root, build } = server.config;
      const file = resolve(root, build.outDir, '_headers');
      let rules: ReturnType<typeof parseHeaders>;
      try {
        rules = parseHeaders(readFileSync(file, 'utf8'));
      } catch (e) {
        throw new Error(`Não foi possível ler ${file} (rode \`vite build\` antes).`, { cause: e });
      }
      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url ?? '/', 'http://preview').pathname;
        for (const [name, value] of Object.entries(headersFor(rules, pathname))) {
          res.setHeader(name, value);
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    assetLinksPlugin(),
    securityHeadersPlugin(),
    VitePWA({
      // Service worker próprio (src/sw.ts): precache dos arquivos do build, push e clique na
      // notificação. `devOptions` fica desligado: o service worker só existe no build.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Clanix Agenda',
        short_name: 'Clanix',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#0F2D5B',
        background_color: '#F8FAFC',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        // Só arquivos estáticos do build (nunca respostas de API).
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Fontes de alfabetos que o app em português não usa ficam fora do cache.
        globIgnores: ['**/*-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*.woff2'],
      },
    }),
  ],
  build: {
    // Fontes sempre como arquivo: embutida em `data:` a CSP (`font-src 'self'`) a bloquearia.
    assetsInlineLimit: (filePath) => (filePath.endsWith('.woff2') ? false : undefined),
  },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
});
