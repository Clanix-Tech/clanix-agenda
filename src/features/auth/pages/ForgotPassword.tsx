import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toAppError } from '@/lib/errors';
import { authErrorMessage, isNetworkError, isRateLimited } from '../authErrors';
import { forgotSchema } from '../schemas';
import { AuthInput, AuthLayout, AuthLink, FormError, TextField } from '../AuthLayout';

type Values = z.infer<typeof forgotSchema>;

export default function ForgotPassword() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const busy = useRef(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(forgotSchema), defaultValues: { email: '' } });

  const onSubmit = async (values: Values) => {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      // Só rede e limite de tentativas são mostrados; o resto vira a mensagem neutra
      // (não revela se o e-mail existe).
      if (err && (isNetworkError(err) || isRateLimited(err))) setError(authErrorMessage(err));
      else setSent(true);
    } catch (e) {
      setError(toAppError(e).message);
    } finally {
      busy.current = false;
    }
  };

  return (
    <AuthLayout title="Recuperar senha" subtitle="Informe seu e-mail para receber um link.">
      {sent ? (
        <>
          <p role="status" className="rounded-lg bg-soft px-3 py-3 text-navy">
            Se houver uma conta com esse e-mail, você vai receber um link.
          </p>
          <p className="mt-6 text-center text-sm">
            <AuthLink to="/entrar">Voltar para entrar</AuthLink>
          </p>
        </>
      ) : (
        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="space-y-4">
          {error && <FormError>{error}</FormError>}
          <TextField label="E-mail" error={errors.email}>
            {(a) => (
              <AuthInput
                {...a}
                type="email"
                inputMode="email"
                autoComplete="email"
                {...register('email')}
              />
            )}
          </TextField>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-12 w-full rounded-xl text-base font-semibold"
          >
            {isSubmitting ? 'Enviando…' : 'Enviar link'}
          </Button>
          <p className="text-center text-sm">
            <AuthLink to="/entrar">Voltar para entrar</AuthLink>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
