import { describe, expect, it } from 'vitest';
import { buildAssetLinks } from './gerar-assetlinks.mjs';

const FP = Array.from({ length: 32 }, (_, i) =>
  (i * 7 + 10).toString(16).toUpperCase().padStart(2, '0').slice(-2),
).join(':');

describe('buildAssetLinks', () => {
  it('gera o assetlinks.json no formato esperado pelo Android', () => {
    expect(buildAssetLinks('br.com.exemplo.agenda', [FP])).toEqual([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'br.com.exemplo.agenda',
          sha256_cert_fingerprints: [FP],
        },
      },
    ]);
  });

  it('aceita mais de uma impressão digital', () => {
    const outra = FP.replace(/^../, 'FF');
    const [item] = buildAssetLinks('br.com.exemplo.agenda', [FP, outra]) as {
      target: { sha256_cert_fingerprints: string[] };
    }[];
    expect(item?.target.sha256_cert_fingerprints).toEqual([FP, outra]);
  });

  it('recusa nome de pacote inválido com mensagem em português', () => {
    expect(() => buildAssetLinks('Agenda', [FP])).toThrow(/pacote.*inválido/i);
    expect(() => buildAssetLinks('br.com.1agenda', [FP])).toThrow(/pacote.*inválido/i);
    expect(() => buildAssetLinks('', [FP])).toThrow(/pacote.*inválido/i);
  });

  it('recusa impressão em minúsculas ou curta', () => {
    expect(() => buildAssetLinks('br.com.exemplo.agenda', [FP.toLowerCase()])).toThrow(
      /impressão digital.*inválida/i,
    );
    expect(() => buildAssetLinks('br.com.exemplo.agenda', ['AA:BB:CC'])).toThrow(
      /impressão digital.*inválida/i,
    );
  });

  it('exige ao menos uma impressão digital', () => {
    expect(() => buildAssetLinks('br.com.exemplo.agenda', [])).toThrow(/pelo menos uma/i);
  });
});
