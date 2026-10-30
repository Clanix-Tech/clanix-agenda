import { useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toAppError } from '@/lib/errors';
import { useAuth } from '../AuthProvider';
import { authErrorMessage } from '../authErrors';
import { loginSchema } from '../schemas';
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
  const state = location.state as { from?: From; reason?: string } | null;
  const expired = state?.reason === 'sessao';
  const target = state?.from?.pathname ? `${state.from.pathname}${state.from.search ?? ''}` : '/';
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
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
      });
      if (err) setError(authErrorMessage(err));
      else void navigate(target, { replace: true });
    } catch (e) {
      setError(toAppError(e).message);
    } finally {
      busy.current = false;
    }
  };

  return (
    <AuthLayout title="Entrar" subtitle="Acesse sua agenda com e-mail e senha.">
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="space-y-4">
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
        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-12 w-full rounded-xl text-base font-semibold"
        >
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Ainda não tem conta? <AuthLink to="/cadastro">Criar conta</AuthLink>
      </p>
    </AuthLayout>
  );
}
