export const ALLOWED_VITE_VARS: readonly string[];
export function checkProductionEnv(
  env: Record<string, string | undefined>,
  options?: { localVapidPublicKey?: string | null },
): string[];
export function readLocalVapidPublicKey(root?: string): string | null;
export function scanBundle(dir: string): string[];
export function verificarProducao(root?: string): Promise<void>;
