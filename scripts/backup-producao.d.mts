export const RETENTION_DAYS: number;
export function backupDir(
  env: Record<string, string | undefined>,
  home: string,
  repoRoot: string,
): string;
export function backupFileNames(now: Date): { roles: string; schema: string; data: string };
export function expiredBackups(
  files: { name: string; mtimeMs: number }[],
  now: Date,
  days?: number,
): string[];
export function maskSecret(text: string, url: string | undefined): string;
