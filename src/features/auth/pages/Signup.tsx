import { useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toAppError } from '@/lib/errors';
import { useAuth } from '../AuthProvider';
import { authErrorMessage } from '../authErrors';
import { signupSchema } from '../schemas';
import { CAPTCHA_HINT, useCaptcha } from '../captcha/useCaptcha';
import {
  AuthInput,
  AuthLayout,
  AuthLink,
  FormError,
  PasswordInput,
  TextField,
} from '../AuthLayout';

type Values = z.infer<typeof signupSchema>;

export default function Signup() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);
  const busy = useRef(false);
  const captcha = useCaptcha('cadastro');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', password: '', confirm: '' },
  });

  if (session) return <Navigate to="/" replace />;

  const onSubmit = async (values: Values) => {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: { data: { display_name: values.name }, captchaToken: captcha.token ?? undefined },
      });
      if (err) setError(authErrorMessage(err));
      else if (data.session) void navigate('/', { replace: true });
      else setConfirmEmail(values.email);
    } catch (e) {
      setError(toAppError(e).message);
    } finally {
      busy.current = false;
      captcha.reset();
    }
  };

  if (confirmEmail) {
    return (
      <AuthLayout title="Confira seu e-mail">
        <p role="status" className="rounded-lg bg-soft px-3 py-3 text-navy">
          Enviamos um link de confirmação para {confirmEmail}.
        </p>
        <p className="mt-6 text-center text-sm">
          <AuthLink to="/entrar">Voltar para entrar</AuthLink>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Criar conta" subtitle="Leva menos de um minuto.">
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="space-y-4">
        {error && <FormError>{error}</FormError>}
        <TextField label="Nome" error={errors.name}>
          {(a) => <AuthInput {...a} type="text" autoComplete="name" {...register('name')} />}
        </TextField>
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
          {(a) => <PasswordInput {...a} autoComplete="new-password" {...register('password')} />}
        </TextField>
        <TextField label="Confirmar senha" error={errors.confirm}>
          {(a) => <PasswordInput {...a} autoComplete="new-password" {...register('confirm')} />}
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
          {isSubmitting ? 'Criando conta…' : 'Criar conta'}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Ao criar sua conta, você concorda com a{' '}
        <AuthLink to="/privacidade">Política de Privacidade</AuthLink>.
      </p>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Já tem conta? <AuthLink to="/entrar">Entrar</AuthLink>
      </p>
    </AuthLayout>
  );
}
