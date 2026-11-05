import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { ExpireRef } from '@/lib/queryClient';
import { forgetThisDevice } from '@/features/notifications/push';

export type SignOutReason = 'usuario' | 'sessao';

type AuthValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** Por que a sessão terminou (`null` enquanto há sessão ou antes de qualquer saída). */
  signOutReason: SignOutReason | null;
  /** Saída pedida pelo usuário (sem aviso de expiração); antes, desliga os lembretes deste aparelho. */
  signOut(): Promise<void>;
  /** Sessão inválida (42501/401): sai só neste aparelho e mostra o aviso em "Entrar". */
  expireSession(): Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({
  children,
  expireRef,
}: {
  children: ReactNode;
  /** Se informado, recebe `expireSession` para o QueryClient global chamar. */
  expireRef?: ExpireRef;
}) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [signOutReason, setSignOutReason] = useState<SignOutReason | null>(null);
  const pendingReason = useRef<SignOutReason | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);

  useEffect(() => {
    let active = true;
    const applySignedOut = () => {
      // SIGNED_OUT sem motivo pedido por nós (ex.: falha ao renovar o token) = sessão expirada
      setSignOutReason(pendingReason.current ?? 'sessao');
      pendingReason.current = null;
      setSession(null);
      queryClient.clear();
    };
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      if (event === 'SIGNED_OUT') {
        applySignedOut();
      } else {
        if (next) setSignOutReason(null);
        setSession(next);
      }
      setLoading(false);
    });
    supabase.auth
      .getSession()
      .then(({ data: res }) => {
        if (active) setSession(res.session);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  const value = useMemo<AuthValue>(() => {
    const run = (reason: SignOutReason, options?: { scope: 'local' }) => {
      pendingReason.current = reason;
      return supabase.auth.signOut(options).then(() => {});
    };
    return {
      session,
      user: session?.user ?? null,
      loading,
      signOutReason,
      // Antes de sair, este aparelho deixa de receber os lembretes desta conta (melhor esforço:
      // com o banco fora do ar, sai mesmo assim depois do tempo limite).
      signOut: async () => {
        await forgetThisDevice().catch(() => {});
        return run('usuario');
      },
      expireSession: () => {
        if (inFlight.current) return inFlight.current;
        const p = run('sessao', { scope: 'local' })
          .catch(() => {})
          .finally(() => {
            inFlight.current = null;
          });
        inFlight.current = p;
        return p;
      },
    };
  }, [session, loading, signOutReason]);

  useEffect(() => {
    if (!expireRef) return;
    expireRef.current = () => void value.expireSession();
  }, [expireRef, value]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- contexto e hook ficam juntos de propósito
export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  return ctx;
}
