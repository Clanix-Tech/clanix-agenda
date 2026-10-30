type Navigator = {
  navigate(to: string, opts?: { replace?: boolean; state?: unknown }): Promise<void>;
};

/**
 * Fora de componentes React: primeiro leva para "Entrar" com o aviso e só depois encerra
 * a sessão local (senão o RequireAuth redirecionaria antes, perdendo o motivo).
 */
export async function handleSessionExpired(
  router: Navigator,
  signOut: () => unknown,
): Promise<void> {
  await router.navigate('/entrar', { replace: true, state: { reason: 'sessao' } });
  // deixa o React exibir a tela de entrada antes de a sessão sumir (evita que o RequireAuth
  // redirecione por conta própria e perca o motivo)
  await new Promise((resolve) => setTimeout(resolve, 0));
  try {
    await signOut();
  } catch {
    // a sessão já é inválida; o aviso na tela de entrada é o que importa
  }
}
