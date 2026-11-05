/** Grava no Vault local a URL da send-reminders e o CRON_SECRET; devolve a URL gravada. */
export function configurarLembretesLocal(opts: {
  apiUrl: string;
  secretKey: string;
}): Promise<string>;
