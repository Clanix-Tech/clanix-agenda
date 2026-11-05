// Gera o assetlinks.json que liga o domínio do app ao APK (TWA).
// Uso: ANDROID_PACKAGE_ID=... ANDROID_CERT_SHA256=AA:BB:... node scripts/gerar-assetlinks.mjs [saida.json]
// Várias impressões digitais: separe por vírgula. Sem argumento, imprime na tela.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PACKAGE_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const FINGERPRINT_RE = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

export function buildAssetLinks(packageId, sha256) {
  if (!PACKAGE_RE.test(packageId)) {
    throw new Error(
      `Nome de pacote inválido: "${packageId}". Use letras minúsculas, números e "_", separados por pontos (ex.: br.com.empresa.agenda).`,
    );
  }
  if (!Array.isArray(sha256) || sha256.length === 0) {
    throw new Error('Informe pelo menos uma impressão digital SHA-256 do certificado.');
  }
  for (const fp of sha256) {
    if (!FINGERPRINT_RE.test(fp)) {
      throw new Error(
        `Impressão digital inválida: "${fp}". Use 32 pares hexadecimais em MAIÚSCULAS separados por ":" (AA:BB:...).`,
      );
    }
  }
  return [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: packageId,
        sha256_cert_fingerprints: sha256,
      },
    },
  ];
}

/** Separa uma lista de impressões digitais por vírgula. */
export function lerFingerprints(valor) {
  return (valor ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const packageId = process.env.ANDROID_PACKAGE_ID ?? '';
    const links = buildAssetLinks(packageId, lerFingerprints(process.env.ANDROID_CERT_SHA256));
    const json = `${JSON.stringify(links, null, 2)}\n`;
    const saida = process.argv[2];
    if (saida) {
      writeFileSync(saida, json);
      console.log(`assetlinks.json gravado em ${saida}`);
    } else {
      process.stdout.write(json);
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
