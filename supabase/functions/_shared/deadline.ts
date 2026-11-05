// Prazo total para uma operação que pode nunca terminar. Puro (sem Deno nem npm:), para o Vitest.

/** Resolve com `onTimeout` se `promise` não terminar em `ms`; o resultado de `promise` vale se vier antes. */
export function withDeadline<T>(promise: Promise<T>, ms: number, onTimeout: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(onTimeout), ms);
  });
  return Promise.race([promise, expired]).finally(() => clearTimeout(timer));
}
