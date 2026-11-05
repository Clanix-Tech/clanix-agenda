export interface HeaderRule {
  pattern: string;
  headers: Record<string, string>;
}
export function buildHeaders(opts: { supabaseUrl: string; turnstile: boolean }): string;
export function parseHeaders(text: string): HeaderRule[];
export function headersFor(rules: HeaderRule[], pathname: string): Record<string, string>;
