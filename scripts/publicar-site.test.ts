import { describe, expect, it } from 'vitest';
import { deployArgs } from './publicar-site.mjs';

describe('deployArgs', () => {
  it('publica sempre no branch de produção, master por padrão', () => {
    expect(deployArgs({ CF_PAGES_PROJECT: 'clanix-agenda' })).toEqual([
      'wrangler',
      'pages',
      'deploy',
      'dist',
      '--project-name=clanix-agenda',
      '--branch=master',
    ]);
  });

  it('usa CF_PAGES_BRANCH quando informado (vazio ou só espaços vale o padrão)', () => {
    expect(deployArgs({ CF_PAGES_PROJECT: 'agenda', CF_PAGES_BRANCH: 'main' })).toContain(
      '--branch=main',
    );
    expect(deployArgs({ CF_PAGES_PROJECT: 'agenda', CF_PAGES_BRANCH: 'release/v1.0' })).toContain(
      '--branch=release/v1.0',
    );
    expect(deployArgs({ CF_PAGES_PROJECT: 'agenda', CF_PAGES_BRANCH: '  ' })).toContain(
      '--branch=master',
    );
  });

  it('recusa projeto ausente ou com caracteres fora do padrão', () => {
    expect(() => deployArgs({})).toThrow(/CF_PAGES_PROJECT/);
    expect(() => deployArgs({ CF_PAGES_PROJECT: 'Agenda Em Ordem && echo x' })).toThrow(
      /CF_PAGES_PROJECT/,
    );
  });

  it('recusa branch que poderia escapar do shell ou não é um nome válido', () => {
    for (const branch of ['main && echo x', 'a;b', '-x', '../master', 'a..b', 'feat$(x)', '"a"']) {
      expect(() => deployArgs({ CF_PAGES_PROJECT: 'agenda', CF_PAGES_BRANCH: branch })).toThrow(
        /CF_PAGES_BRANCH/,
      );
    }
  });
});
