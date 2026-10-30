import { describe, expect, it } from 'vitest';
import { toAppError } from '@/lib/errors';

describe('toAppError', () => {
  it.each([
    [{ code: 'AE001' }, 'conflito', 'Esse horário já está ocupado. Escolha outro horário.'],
    [{ code: 'AE002' }, 'fora_expediente', 'Esse horário está fora do seu expediente.'],
    [{ code: 'AE003' }, 'meia_noite', 'O atendimento precisa começar e terminar no mesmo dia.'],
    [
      { code: 'AE004' },
      'passado',
      'Esse horário já passou. Confirme se é um registro de atendimento antigo.',
    ],
    [{ code: 'AE005' }, 'transicao', 'Essa ação não é permitida para o status atual.'],
    [{ code: 'AE006' }, 'nao_encontrado', 'Atendimento não encontrado.'],
    [{ code: '42501' }, 'sessao', 'Sua sessão expirou. Entre novamente.'],
    [{ code: 'PGRST301' }, 'sessao', 'Sua sessão expirou. Entre novamente.'],
    [
      { status: 401, name: 'AuthApiError', message: 'x' },
      'sessao',
      'Sua sessão expirou. Entre novamente.',
    ],
    [{ code: '23514' }, 'dados_invalidos', 'Alguns dados estão inválidos. Revise os campos.'],
    [{ code: '23502' }, 'dados_invalidos', 'Alguns dados estão inválidos. Revise os campos.'],
    [{ code: '22023' }, 'dados_invalidos', 'Alguns dados estão inválidos. Revise os campos.'],
    [{ code: '22P02' }, 'dados_invalidos', 'Alguns dados estão inválidos. Revise os campos.'],
    [new TypeError('Failed to fetch'), 'rede', 'Sem conexão. Nada foi salvo — tente novamente.'],
    [
      { message: 'TypeError: Failed to fetch' },
      'rede',
      'Sem conexão. Nada foi salvo — tente novamente.',
    ],
    [{ code: 'XX999' }, 'desconhecido', 'Algo deu errado. Tente novamente.'],
    ['boom', 'desconhecido', 'Algo deu errado. Tente novamente.'],
    [null, 'desconhecido', 'Algo deu errado. Tente novamente.'],
    [undefined, 'desconhecido', 'Algo deu errado. Tente novamente.'],
  ])('mapeia %j', (err, kind, message) => {
    expect(toAppError(err)).toEqual({ kind, message });
  });

  it('nunca expõe details, hint nem a mensagem crua', () => {
    const r = toAppError({
      code: '23514',
      message: 'new row violates check secret_msg',
      details: 'Failing row contains (secret)',
      hint: 'secret_hint',
    });
    expect(JSON.stringify(r)).not.toMatch(/secret/);
  });

  it('offline vira rede', () => {
    const spy = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    expect(toAppError({ code: 'XX999' }).kind).toBe('rede');
    spy.mockRestore();
  });
});
