import { z } from 'zod';
import { PASSWORD_MIN } from './authErrors';

const email = z.string().trim().pipe(z.email('Informe um e-mail válido.'));
const newPassword = z
  .string()
  .min(PASSWORD_MIN, `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`);

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Informe sua senha.'),
});

export const signupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Informe seu nome (até 80 caracteres).')
      .max(80, 'Informe seu nome (até 80 caracteres).'),
    email,
    password: newPassword,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'As senhas não são iguais.',
  });

export const forgotSchema = z.object({ email });

export const resetSchema = z
  .object({ password: newPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'As senhas não são iguais.',
  });
