export const ALLOWED_VITE_VARS: readonly string[];
export function checkProductionEnv(env: Record<string, string | undefined>): string[];
export function scanBundle(dir: string): string[];
export function verificarProducao(root?: string): Promise<void>;
