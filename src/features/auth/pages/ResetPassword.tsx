import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/feedback/LoadingState';
import { supabase } from '@/lib/supabase';
import { toAppError } from '@/lib/errors';
import { useAuth } from '../AuthProvider';
import { authErrorMessage } from '../authErrors';
import { resetSchema } from '../schemas';
import { AuthLayout, AuthLink, FormError, PasswordInput, TextField } from '../AuthLayout';

type Values = z.infer<typeof resetSchema>;

export default function ResetPassword() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirm: '' },
  });

  if (loading) return <LoadingState label="Carregando…" />;

  if (!session) {
    return (
      <AuthLayout title="Redefinir senha">
        <p role="alert" className="rounded-lg bg-error-surface px-3 py-3 text-error">
          Este link expirou ou já foi usado. Peça um novo.
        </p>
        <p className="mt-6 text-center text-sm">
          <AuthLink to="/recuperar-senha">Pedir novo link</AuthLink>
        </p>
      </AuthLayout>
    );
  }

  const onSubmit = async (values: Values) => {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    try {
      const { error: err } = await supabase.auth.updateUser({ password: values.password });
      if (err) {
        setError(authErrorMessage(err));
      } else {
        toast.success('Senha alterada');
        void navigate('/', { replace: true });
      }
    } catch (e) {
      setError(toAppError(e).message);
    } finally {
      busy.current = false;
    }
  };

  return (
    <AuthLayout title="Redefinir senha" subtitle="Escolha uma nova senha.">
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="space-y-4">
        {error && <FormError>{error}</FormError>}
        <TextField label="Nova senha" error={errors.password}>
          {(a) => <PasswordInput {...a} autoComplete="new-password" {...register('password')} />}
        </TextField>
        <TextField label="Confirmar senha" error={errors.confirm}>
          {(a) => <PasswordInput {...a} autoComplete="new-password" {...register('confirm')} />}
        </TextField>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-12 w-full rounded-xl text-base font-semibold"
        >
          {isSubmitting ? 'Salvando…' : 'Salvar nova senha'}
        </Button>
      </form>
    </AuthLayout>
  );
}
