import { useRef, useState, type FormEvent, type RefObject } from 'react';
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
import { authErrorMessage } from '@/features/auth/authErrors';
import { CAPTCHA_HINT, useCaptcha } from '@/features/auth/captcha/useCaptcha';
import { DeleteAccountError, deleteAccount, type DeleteAccountErrorKind } from './deleteAccount';

const MESSAGES: Record<DeleteAccountErrorKind, string> = {
  senha: 'Senha incorreta.',
  captcha: authErrorMessage({ code: 'captcha_failed' }),
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
  // Fica aqui (fora do formulário) para impedir o fechamento por Esc/clique fora durante o envio.
  const busyRef = useRef(false);

  const close = (next: boolean) => {
    if (busyRef.current) return;
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        {/* O formulário (e o CAPTCHA) só existem com o diálogo aberto: montam ao abrir e
            recomeçam do zero a cada abertura. */}
        <DeleteAccountForm busyRef={busyRef} onCancel={() => close(false)} />
      </DialogContent>
    </Dialog>
  );
}

function DeleteAccountForm({
  busyRef,
  onCancel,
}: {
  busyRef: RefObject<boolean>;
  onCancel: () => void;
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const captcha = useCaptcha('excluir-conta');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const blocked = captcha.required && !captcha.token;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busyRef.current || blocked) return;
    if (!password) {
      setError(MESSAGES.senha);
      return;
    }
    busyRef.current = true;
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
      busyRef.current = false;
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
    busyRef.current = false;
    void navigate('/entrar?conta=excluida', { replace: true });
  };

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Excluir minha conta</DialogTitle>
        <DialogDescription>
          Isso apaga sua conta e todos os seus dados e não dá para desfazer. Digite sua senha atual
          para confirmar.
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
          onClick={onCancel}
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
  );
}
