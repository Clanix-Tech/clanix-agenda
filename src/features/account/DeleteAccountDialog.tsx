import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/features/auth/AuthProvider';
import { CAPTCHA_HINT, useCaptcha } from '@/features/auth/captcha/useCaptcha';
import { DeleteAccountError, deleteAccount, type DeleteAccountErrorKind } from './deleteAccount';

const MESSAGES: Record<DeleteAccountErrorKind, string> = {
  senha: 'Senha incorreta.',
  rede: 'Sem conexão. Confira a internet e tente de novo.',
  falha: 'Não foi possível excluir a conta agora. Tente de novo em alguns minutos.',
};

export function DeleteAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const captcha = useCaptcha('excluir-conta');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);

  const blocked = captcha.required && !captcha.token;

  const close = (next: boolean) => {
    if (busy.current) return;
    if (!next) {
      setPassword('');
      setError(null);
    }
    onOpenChange(next);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy.current || blocked) return;
    if (!password) {
      setError(MESSAGES.senha);
      return;
    }
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      await deleteAccount({
        email: user?.email ?? '',
        password,
        captchaToken: captcha.token,
      });
    } catch (err) {
      setError(MESSAGES[err instanceof DeleteAccountError ? err.kind : 'falha']);
      busy.current = false;
      setPending(false);
      captcha.reset();
      return;
    }
    captcha.reset();
    // Conta apagada: sai deste aparelho e leva a pessoa para a entrada com o aviso.
    try {
      await signOut({ accountDeleted: true });
    } catch {
      // a conta já não existe; a sessão local some de qualquer jeito
    }
    void navigate('/entrar?conta=excluida', { replace: true });
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <form onSubmit={(e) => void submit(e)} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Excluir minha conta</DialogTitle>
            <DialogDescription>
              Isso apaga sua conta e todos os seus dados e não dá para desfazer. Digite sua senha
              atual para confirmar.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="excluir-senha">Senha atual</Label>
            <Input
              id="excluir-senha"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 text-base"
            />
          </div>
          {captcha.element}
          {blocked && <p className="text-sm text-[#475569]">{CAPTCHA_HINT}</p>}
          {error && (
            <p role="alert" className="text-sm font-medium text-[#B91C1C]">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={pending}
              onClick={() => close(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={pending || blocked}
              className="h-11 bg-[#B91C1C] text-white hover:bg-[#991B1B]"
            >
              {pending ? 'Excluindo…' : 'Excluir para sempre'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
