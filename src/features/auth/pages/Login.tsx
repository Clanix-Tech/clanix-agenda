import { useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toAppError } from '@/lib/errors';
import { useAuth } from '../AuthProvider';
import { authErrorMessage } from '../authErrors';
import { safeRedirectPath } from '../safeRedirect';
import { loginSchema } from '../schemas';
import { CAPTCHA_HINT, useCaptcha } from '../captcha/useCaptcha';
import {
  AuthInput,
  AuthLayout,
  AuthLink,
  FormError,
  PasswordInput,
  TextField,
} from '../AuthLayout';

type Values = z.infer<typeof loginSchema>;
type From = { pathname?: string; search?: string };

export default function Login() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useAuth();
  const deleted = new URLSearchParams(location.search).get('conta') === 'excluida';
  const state = location.state as { from?: From; reason?: string } | null;
  const expired = state?.reason === 'sessao';
  const target = safeRedirectPath(state?.from);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const captcha = useCaptcha('login');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  if (session) return <Navigate to={target} replace />;

  const onSubmit = async (values: Values) => {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
        options: { captchaToken: captcha.token ?? undefined },
      });
      if (err) setError(authErrorMessage(err));
      else void navigate(target, { replace: true });
    } catch (e) {
      setError(toAppError(e).message);
    } finally {
      busy.current = false;
      captcha.reset();
    }
  };

  return (
    <AuthLayout title="Entrar" subtitle="Acesse sua agenda com e-mail e senha.">
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="space-y-4">
        {deleted && (
          <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
            Sua conta e todos os seus dados foram excluídos.
          </p>
        )}
        {expired && <FormError>{toAppError({ code: '42501' }).message}</FormError>}
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
        <TextField label="Senha" error={errors.password}>
          {(a) => (
            <PasswordInput {...a} autoComplete="current-password" {...register('password')} />
          )}
        </TextField>
        <div className="text-right text-sm">
          <AuthLink to="/recuperar-senha">Esqueci minha senha</AuthLink>
        </div>
        {captcha.element}
        {captcha.required && !captcha.token && (
          <p className="text-sm text-muted-foreground">{CAPTCHA_HINT}</p>
        )}
        <Button
          type="submit"
          disabled={isSubmitting || (captcha.required && !captcha.token)}
          className="h-12 w-full rounded-xl text-base font-semibold"
        >
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Ainda não tem conta? <AuthLink to="/cadastro">Criar conta</AuthLink>
      </p>
      <p className="mt-1 text-center text-sm">
        <Link
          to="/instalar"
          className="inline-flex min-h-11 items-center font-semibold text-blue-700 underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Como instalar o app
        </Link>
      </p>
      <p className="text-center text-sm">
        <Link
          to="/privacidade"
          className="inline-flex min-h-11 items-center font-semibold text-blue-700 underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Política de Privacidade
        </Link>
      </p>
    </AuthLayout>
  );
}
