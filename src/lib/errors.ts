export type AppErrorKind =
  | 'conflito'
  | 'fora_expediente'
  | 'meia_noite'
  | 'passado'
  | 'transicao'
  | 'nao_encontrado'
  | 'sessao'
  | 'dados_invalidos'
  | 'rede'
  | 'desconhecido';

export type AppError = { kind: AppErrorKind; message: string };

const MESSAGES: Record<AppErrorKind, string> = {
  conflito: 'Esse horário já está ocupado. Escolha outro horário.',
  fora_expediente: 'Esse horário está fora do seu expediente.',
  meia_noite: 'O atendimento precisa começar e terminar no mesmo dia.',
  passado: 'Esse horário já passou. Confirme se é um registro de atendimento antigo.',
  transicao: 'Essa ação não é permitida para o status atual.',
  nao_encontrado: 'Atendimento não encontrado.',
  sessao: 'Sua sessão expirou. Entre novamente.',
  dados_invalidos: 'Alguns dados estão inválidos. Revise os campos.',
  rede: 'Sem conexão. Nada foi salvo — tente novamente.',
  desconhecido: 'Algo deu errado. Tente novamente.',
};

const BY_CODE: Record<string, AppErrorKind> = {
  AE001: 'conflito',
  AE002: 'fora_expediente',
  AE003: 'meia_noite',
  AE004: 'passado',
  AE005: 'transicao',
  AE006: 'nao_encontrado',
  '42501': 'sessao',
  PGRST301: 'sessao',
  '23514': 'dados_invalidos',
  '23502': 'dados_invalidos',
  '22023': 'dados_invalidos',
  '22P02': 'dados_invalidos',
};

function build(kind: AppErrorKind): AppError {
  return { kind, message: MESSAGES[kind] };
}

const FETCH_FAILURE = /Failed to fetch|Load failed|NetworkError|^TypeError:/;

function isFailedFetch(message: unknown): boolean {
  return typeof message === 'string' && FETCH_FAILURE.test(message);
}

/** Converte qualquer erro em mensagem segura; nunca copia details/hint/mensagem crua. */
export function toAppError(err: unknown): AppError {
  const obj =
    typeof err === 'object' && err !== null ? (err as Record<string, unknown>) : undefined;

  if (obj) {
    // Idempotente: um AppError ja mapeado (ex.: langado por uma mutacao) passa intacto.
    if (typeof obj.kind === 'string' && obj.kind in MESSAGES && typeof obj.message === 'string') {
      return build(obj.kind as AppErrorKind);
    }
    const code = obj.code;
    if (typeof code === 'string' && code in BY_CODE) {
      const k = BY_CODE[code];
      if (k) return build(k);
    }
    if (obj.status === 401) return build('sessao');
    if (obj.name === 'AuthRetryableFetchError') return build('rede');
    if (isFailedFetch(obj.message)) return build('rede');
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return build('rede');
  return build('desconhecido');
}
