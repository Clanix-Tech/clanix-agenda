/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@/test/contrast';

const css = readFileSync('src/styles/index.css', 'utf8');

function bloco(seletor: string): Record<string, string> {
  const inicio = css.indexOf(`${seletor} {`);
  if (inicio < 0) throw new Error(`Bloco ${seletor} ausente em index.css`);
  const corpo = css.slice(inicio, css.indexOf('\n}', inicio));
  const vars: Record<string, string> = {};
  for (const m of corpo.matchAll(/--([\w-]+):\s*([^;]+);/g))
    if (m[1] && m[2]) vars[m[1]] = m[2].trim();
  return vars;
}

const temas = { claro: bloco(':root'), escuro: bloco('.dark') } as const;
const HERO = ['#16063E', '#0B0420', '#24075E'];

function v(tema: Record<string, string>, nome: string): string {
  const valor = tema[nome];
  if (!valor) throw new Error(`Variável --${nome} ausente`);
  return valor;
}

describe.each(Object.entries(temas))('contraste (%s)', (_nome, t) => {
  const fundos = ['background', 'card', 'muted'];
  const pares: [string, string, string?][] = [];
  for (const fg of [
    'foreground',
    'foreground-secondary',
    'muted-foreground',
    'link',
    'error',
    'card-foreground',
  ]) {
    for (const bg of fundos) pares.push([fg, bg]);
  }
  pares.push(['primary-foreground', 'primary'], ['primary-foreground', 'primary-hover']);
  pares.push(['secondary-foreground', 'secondary', 'card']);
  pares.push(['destructive-foreground', 'destructive']);
  for (const s of ['success', 'warning', 'info'])
    pares.push([`${s}-foreground`, `${s}-surface`, 'card']);
  for (const s of ['agendado', 'concluido', 'nao-compareceu', 'cancelado']) {
    pares.push([`status-${s}-foreground`, `status-${s}`, 'card']);
  }

  it.each(pares)('%s sobre %s >= 4,5', (fg, bg, sobre) => {
    const r = contrastRatio(v(t, fg), v(t, bg), v(t, sobre ?? 'background'));
    expect(r, `${fg} sobre ${bg}: ${r.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['primary-foreground', 'primary'],
    ['card', 'muted-foreground'],
  ])('polegar do switch (%s) sobre %s >= 3', (fg, bg) => {
    const r = contrastRatio(v(t, fg), v(t, bg), v(t, 'background'));
    expect(r, `${fg} sobre ${bg}: ${r.toFixed(2)}`).toBeGreaterThanOrEqual(3);
  });

  it.each(['agenda', 'ring', 'error'])('%s sobre background e card >= 3', (fg) => {
    for (const bg of ['background', 'card']) {
      const r = contrastRatio(v(t, fg), v(t, bg));
      expect(r, `${fg} sobre ${bg}: ${r.toFixed(2)}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('primary-foreground sobre as duas paradas do gradiente de destaque >= 4,5', () => {
    const paradas = v(t, 'gradient-destaque').match(/#[0-9a-fA-F]{6}/g) ?? [];
    expect(paradas).toHaveLength(2);
    for (const parada of paradas) {
      const r = contrastRatio(v(t, 'primary-foreground'), parada);
      expect(r, `primary-foreground sobre ${parada}: ${r.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(HERO)('hero-foreground e hero-secondary sobre %s >= 4,5', (parada) => {
    for (const fg of ['hero-foreground', 'hero-secondary']) {
      const r = contrastRatio(v(t, fg), parada);
      expect(r, `${fg} sobre ${parada}: ${r.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('contorno de foco base', () => {
  it('o outline padrão de index.css é opaco (alfa deixa o foco abaixo de 3:1)', () => {
    expect(css).toMatch(/\boutline-ring\b(?!\/)/);
    expect(css).not.toMatch(/outline-ring\/\d+/);
  });
});
