import { Link } from 'react-router';
import { useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { toAppError } from '@/lib/errors';
import { useAuth } from '@/features/auth/AuthProvider';
import { authErrorMessage } from '@/features/auth/authErrors';
import { resetSchema } from '@/features/auth/schemas';
import { exportAppointmentsCsv, NO_FILTERS } from '@/features/history/exportCsv';
import type { Profile } from '@/features/profile/api';
import { DeleteAccountDialog } from '@/features/account/DeleteAccountDialog';
import { FIELD, SaveButton, SectionCard } from './shared';

function passwordMessage(err: unknown): string {
  const code = typeof err === 'object' && err !== null ? (err as { code?: unknown }).code : null;
  if (code === 'same_password') return 'A nova senha precisa ser diferente da atual.';
  return authErrorMessage(err);
}

export function AccountSection({ profile }: { profile: Profile }) {
  const { signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const exportBusy = useRef(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (busy.current) return;
    const parsed = resetSchema.safeParse({ password, confirm });
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] === 'confirm' ? 'confirm' : 'password';
        next[field] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setError(null);
    busy.current = true;
    setPending(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) throw authError;
      setPassword('');
      setConfirm('');
      toast.success('Senha alterada');
    } catch (err) {
      setError(passwordMessage(err));
    } finally {
      busy.current = false;
      setPending(false);
    }
  };

  const download = async () => {
    if (exportBusy.current) return;
    exportBusy.current = true;
    setExporting(true);
    setExportError(null);
    try {
      await exportAppointmentsCsv(NO_FILTERS, profile.timezone);
    } catch (err) {
      setExportError(toAppError(err).message);
    } finally {
      exportBusy.current = false;
      setExporting(false);
    }
  };

  return (
    <SectionCard title="Conta e privacidade">
      <div className="flex max-w-md flex-col gap-8">
        <form onSubmit={(e) => void changePassword(e)} noValidate className="flex flex-col gap-4">
          <h3 className="font-display text-base font-semibold text-foreground">Alterar senha</h3>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="conta-senha">Nova senha</Label>
            <Input
              id="conta-senha"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={errors.password ? true : undefined}
              className={FIELD}
            />
            {errors.password && (
              <p role="alert" className="text-sm text-error">
                {errors.password}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="conta-confirmar">Confirmar nova senha</Label>
            <Input
              id="conta-confirmar"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={errors.confirm ? true : undefined}
              className={FIELD}
            />
            {errors.confirm && (
              <p role="alert" className="text-sm text-error">
                {errors.confirm}
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className="text-sm font-medium text-error">
              {error}
            </p>
          )}
          <div>
            <SaveButton pending={pending} label="Alterar senha" />
          </div>
        </form>

        <div className="flex flex-col gap-2">
          <h3 className="font-display text-base font-semibold text-foreground">Seus dados</h3>
          <p className="text-[15px] text-foreground-secondary">
            Baixe todos os seus atendimentos em uma planilha.
          </p>
          <p className="text-[15px] text-foreground-secondary">
            Veja como cuidamos dos seus dados na{' '}
            <Link
              to="/privacidade"
              className="rounded-sm font-semibold text-link underline underline-offset-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
            >
              Política de Privacidade
            </Link>
            .
          </p>
          <div>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={exporting}
              onClick={() => void download()}
            >
              Baixar meus dados (CSV)
            </Button>
          </div>
          {exporting && (
            <p role="status" className="text-sm text-muted-foreground">
              Preparando o arquivo…
            </p>
          )}
          {exportError && (
            <p role="alert" className="text-sm text-error">
              {exportError}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-6">
          <h3 className="font-display text-base font-semibold text-foreground">Excluir conta</h3>
          <p className="text-[15px] text-foreground-secondary">
            Apaga sua conta e todos os seus dados: clientes, atendimentos, histórico e aparelhos com
            lembretes. Não dá para desfazer.
          </p>
          <p className="text-[15px] text-foreground-secondary">
            Se quiser, baixe seus dados acima antes de excluir.
          </p>
          <div>
            <Button
              type="button"
              variant="destructive"
              className="h-11"
              onClick={() => setDeleteOpen(true)}
            >
              Excluir minha conta
            </Button>
          </div>
        </div>

        <div>
          <Button type="button" variant="outline" className="h-11" onClick={() => void signOut()}>
            Sair
          </Button>
        </div>
      </div>
      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </SectionCard>
  );
}
