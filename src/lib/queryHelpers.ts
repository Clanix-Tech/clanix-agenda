import { toAppError } from '@/lib/errors';

/** Consulta: devolve os dados ou lança o erro cru (o QueryClient o classifica). */
export async function must<T>(q: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await q;
  if (error) throw error;
  return data as T;
}

/** Mutação: qualquer falha (resposta de erro ou exceção) vira `AppError`. */
export async function guard<T>(run: () => PromiseLike<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    throw toAppError(err);
  }
}
