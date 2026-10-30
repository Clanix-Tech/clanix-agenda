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

  it.each([
    [new TypeError('Load failed')],
    [new TypeError('NetworkError when attempting to fetch resource.')],
    [{ message: 'TypeError: Load failed' }],
    [{ message: 'TypeError: NetworkError when attempting to fetch resource.' }],
    [{ message: 'TypeError: fetch failed' }],
    [{ name: 'AuthRetryableFetchError', status: 0, message: 'x' }],
  ])('rede em outros navegadores: %j', (err) => {
    expect(toAppError(err).kind).toBe('rede');
  });

  it('TypeError de código (não de fetch) é desconhecido', () => {
    expect(toAppError(new TypeError("Cannot read properties of undefined (reading 'x')"))).toEqual({
      kind: 'desconhecido',
      message: 'Algo deu errado. Tente novamente.',
    });
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

  it('e idempotente para um AppError ja mapeado', () => {
    const e = toAppError({ code: '42501' });
    expect(toAppError(e)).toEqual(e);
    expect(toAppError({ kind: 'conflito', message: 'x' }).kind).toBe('conflito');
  });

  it('PGRST116 (nenhuma linha) vira nao_encontrado', () => {
    expect(toAppError({ code: 'PGRST116' }).kind).toBe('nao_encontrado');
  });

  it('nao confunde chaves do prototype com codigos ou kinds', () => {
    expect(toAppError({ code: 'toString' }).kind).toBe('desconhecido');
    expect(toAppError({ kind: 'toString', message: 'x' }).kind).toBe('desconhecido');
  });
});
