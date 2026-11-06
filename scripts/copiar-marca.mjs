// Copia do pacote de marca (clanix-brand/, fora do git) só os ativos que o app usa.
// Única alteração: nos logos horizontais, remove o retângulo de fundo opaco. Uso: npm run marca:copiar
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RETANGULO = /<rect\b[^>]*\/?>(?:\s*<\/rect>)?[ \t]*\r?\n?/g;

function atributo(tag, nome) {
  const m = new RegExp(String.raw`\s${nome}="([^"]*)"`).exec(tag);
  return m ? m[1] : null;
}

/** Remove do SVG o único `<rect>` de fundo (sem x/y, com largura e altura do viewBox). */
export function semFundo(svg) {
  const vb = /viewBox="\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*"/.exec(svg);
  if (!vb) throw new Error('SVG sem viewBox "0 0 L A": não dá para achar o retângulo de fundo.');
  const fundos = [...svg.matchAll(RETANGULO)].filter((m) => {
    const tag = m[0];
    return (
      atributo(tag, 'x') === null &&
      atributo(tag, 'y') === null &&
      Number(atributo(tag, 'width')) === Number(vb[1]) &&
      Number(atributo(tag, 'height')) === Number(vb[2])
    );
  });
  if (fundos.length !== 1) {
    throw new Error(`Esperava exatamente 1 retângulo de fundo, achei ${fundos.length}.`);
  }
  const [achado] = fundos;
  // Leva junto a indentação da linha do retângulo, para o resto ficar idêntico.
  const inicio = achado.index - /[^\S\r\n]*$/.exec(svg.slice(0, achado.index))[0].length;
  return svg.slice(0, inicio) + svg.slice(achado.index + achado[0].length);
}

const COPIAS = [
  [
    'logo-clanix-agenda-horizontal-light.svg',
    'src/assets/brand/clanix-agenda-horizontal-claro.svg',
    true,
  ],
  [
    'logo-clanix-agenda-horizontal-dark.svg',
    'src/assets/brand/clanix-agenda-horizontal-escuro.svg',
    true,
  ],
  ['icon-clanix-agenda.svg', 'src/assets/brand/clanix-agenda-icone.svg', false],
  ['icon-clanix-agenda.svg', 'public/favicon.svg', false],
];

export function copiarMarca(raiz) {
  const pacote = join(raiz, 'clanix-brand', 'products', 'clanix-agenda');
  if (!existsSync(join(raiz, 'clanix-brand'))) {
    throw new Error(
      'Pasta clanix-brand/ não encontrada na raiz do repositório. Copie o pacote oficial de marca para lá e rode de novo.',
    );
  }
  for (const [origem, destino, tirarFundo] of COPIAS) {
    const de = join(pacote, origem);
    if (!existsSync(de))
      throw new Error(`Arquivo ausente no pacote: products/clanix-agenda/${origem}`);
    const para = join(raiz, destino);
    mkdirSync(dirname(para), { recursive: true });
    if (tirarFundo) writeFileSync(para, semFundo(readFileSync(de, 'utf8')));
    else copyFileSync(de, para);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    copiarMarca(join(dirname(fileURLToPath(import.meta.url)), '..'));
    console.log('Marca copiada.');
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
