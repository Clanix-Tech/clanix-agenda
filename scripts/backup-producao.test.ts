import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { backupDir, backupFileNames, expiredBackups, maskSecret } from './backup-producao.mjs';

const repo = path.resolve('/projetos/agenda-em-ordem');
const home = path.resolve('/usuarios/maria');
const DAY = 24 * 60 * 60 * 1000;

describe('backupDir', () => {
  it('usa a pasta padrão fora do repositório', () => {
    expect(backupDir({}, home, repo)).toBe(path.join(home, 'Backups', 'agenda-em-ordem'));
  });

  it('usa AGENDA_BACKUP_DIR quando informado', () => {
    const dir = path.resolve('/dados/bkp');
    expect(backupDir({ AGENDA_BACKUP_DIR: dir }, home, repo)).toBe(dir);
  });

  it('lança se o caminho estiver dentro do repositório ou for o próprio repositório', () => {
    expect(() => backupDir({ AGENDA_BACKUP_DIR: path.join(repo, 'backups') }, home, repo)).toThrow(
      /repositório/,
    );
    expect(() => backupDir({ AGENDA_BACKUP_DIR: repo }, home, repo)).toThrow(/repositório/);
  });
});

describe('backupDir (nome parecido com ..)', () => {
  it('rejeita pasta do repositório cujo nome começa com ..', () => {
    expect(() => backupDir({ AGENDA_BACKUP_DIR: path.join(repo, '..foo') }, home, repo)).toThrow(
      /repositório/,
    );
  });
});

describe('backupFileNames', () => {
  it('usa o horário local da máquina no formato AAAA-MM-DD_HHmm-tipo.sql', () => {
    const d = new Date(2026, 10, 5, 13, 7);
    expect(backupFileNames(d)).toEqual({
      roles: '2026-11-05_1307-roles.sql',
      schema: '2026-11-05_1307-schema.sql',
      data: '2026-11-05_1307-data.sql',
    });
  });
});

describe('expiredBackups', () => {
  it('devolve só os arquivos com mais de 30 dias', () => {
    const now = new Date('2026-11-05T12:00:00Z');
    const files = [
      { name: '2026-10-10_0900-schema.sql', mtimeMs: now.getTime() - 29 * DAY },
      { name: '2026-09-01_0900-schema.sql', mtimeMs: now.getTime() - 31 * DAY },
    ];
    expect(expiredBackups(files, now)).toEqual(['2026-09-01_0900-schema.sql']);
  });

  it('só considera arquivos com o nome gerado pelo script', () => {
    const now = new Date('2026-11-05T12:00:00Z');
    const files = [
      { name: 'minhas-consultas.sql', mtimeMs: now.getTime() - 60 * DAY },
      { name: '2026-09-01_0900-data.sql', mtimeMs: now.getTime() - 60 * DAY },
    ];
    expect(expiredBackups(files, now)).toEqual(['2026-09-01_0900-data.sql']);
  });
});

describe('maskSecret', () => {
  it('esconde a URL do banco em mensagens', () => {
    const url = 'postgresql://postgres:segredo@db.x.supabase.co:5432/postgres';
    expect(maskSecret(`falha em ${url}!`, url)).not.toContain('segredo');
    expect(maskSecret(`senha segredo`, url)).not.toContain('segredo');
  });
});
