import { authErrorMessage } from './authErrors';

describe('authErrorMessage (produção)', () => {
  it('captcha_failed', () => {
    expect(authErrorMessage({ code: 'captcha_failed', status: 400 })).toBe(
      'Não foi possível confirmar que você não é um robô. Tente de novo.',
    );
  });
  it('email_not_confirmed', () => {
    expect(authErrorMessage({ code: 'email_not_confirmed', status: 400 })).toBe(
      'Confirme seu e-mail pelo link que enviamos antes de entrar.',
    );
  });
});
