import { describe, expect, it } from 'vitest';
import { semFundo } from './copiar-marca.mjs';

const MIOLO =
  '<defs><linearGradient id="a"/></defs><rect x="204" y="30" width="2.2" height="140" rx="1.1" fill="#8A2BE2"/><path d="M0 0"/>\n';
const abre =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 200" width="1240" height="400">\n';

describe('semFundo', () => {
  it('remove só o retângulo de fundo e mantém o resto byte a byte', () => {
    const fundo = '<rect width="620" height="200" rx="20" fill="#F8F7FF"/>\n';
    const saida = semFundo(`${abre}${fundo}${MIOLO}</svg>`);
    expect(saida).toBe(`${abre}${MIOLO}</svg>`);
  });

  it('não altera o viewBox', () => {
    const saida = semFundo(`${abre}<rect width="620" height="200" fill="#0B0420"/>${MIOLO}</svg>`);
    expect(saida).toContain('viewBox="0 0 620 200"');
  });

  it('lança erro sem retângulo de fundo', () => {
    expect(() => semFundo(`${abre}${MIOLO}</svg>`)).toThrow(Error);
  });

  it('lança erro com mais de um retângulo de fundo', () => {
    const r = '<rect width="620" height="200" fill="#000"/>';
    expect(() => semFundo(`${abre}${r}${r}</svg>`)).toThrow(Error);
  });
});
