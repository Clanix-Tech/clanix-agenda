import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toAppError } from '@/lib/errors';
import { authErrorMessage, isNetworkError, isRateLimited } from '../authErrors';

function isNeutralClientError(err: unknown): boolean {
  if (isNetworkError(err) || isRateLimited(err)) return false;
  const status = (err as { status?: unknown }).status;
  return typeof status === 'number' && status >= 400 && status < 500;
}
import { forgotSchema } from '../schemas';
import { CAPTCHA_HINT, useCaptcha } from '../captcha/useCaptcha';
import { AuthInput, AuthLayout, AuthLink, FormError, TextField } from '../AuthLayout';

type Values = z.infer<typeof forgotSchema>;

export default function ForgotPassword() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const busy = useRef(false);
  const captcha = useCaptcha('recuperar');
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
        captchaToken: captcha.token ?? undefined,
      });
      // Só um erro do cliente (4xx, exceto limite de tentativas) vira a mensagem neutra: é o
      // que poderia revelar se o e-mail existe. Rede, limite, 5xx e erro desconhecido nunca
      // fingem que o link foi enviado.
      if (err && !isNeutralClientError(err)) setError(authErrorMessage(err));
      else setSent(true);
    } catch (e) {
      setError(toAppError(e).message);
    } finally {
      busy.current = false;
      captcha.reset();
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
          {captcha.element}
          {captcha.required && !captcha.token && (
            <p className="text-sm text-muted-foreground">{CAPTCHA_HINT}</p>
          )}
          <Button
            type="submit"
            disabled={isSubmitting || (captcha.required && !captcha.token)}
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
