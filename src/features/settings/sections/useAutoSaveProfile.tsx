import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { toAppError } from '@/lib/errors';
import { useUpdateProfile, type Profile, type ProfilePatch } from '@/features/profile/api';

type Phase = 'idle' | 'saving' | 'saved' | 'error';

const SAVED_MS = 2500;

/**
 * Salvamento imediato de preferências do perfil. Um pedido por vez: mudanças feitas durante um
 * pedido viram um único patch (vale a última escolha de cada coluna) enviado quando ele termina.
 * Até a última gravação terminar, cada controle mostra a própria última escolha.
 */
export function useAutoSaveProfile(profile: Profile) {
  const mutation = useUpdateProfile();

  const [optimistic, setOptimistic] = useState<ProfilePatch>({});
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const inflight = useRef(false);
  const pending = useRef<ProfilePatch>({});
  const failed = useRef<ProfilePatch>({});
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (phase !== 'saved') return;
    const timer = setTimeout(() => setPhase('idle'), SAVED_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  const pump = async () => {
    if (inflight.current) return;
    inflight.current = true;
    setPhase('saving');
    while (Object.keys(pending.current).length > 0) {
      const patch = pending.current;
      pending.current = {};
      try {
        await mutation.mutateAsync(patch);
      } catch (err) {
        failed.current = { ...failed.current, ...patch };
        if (!mounted.current) {
          // A seção já saiu da tela: sem aviso aqui, a falha passaria despercebida.
          toast.error(`Não foi possível salvar suas preferências. ${toAppError(err).message}`);
        } else {
          setErrorMessage((err as { message?: string }).message ?? 'Algo deu errado.');
          // Descarta só as escolhas que falharam e não foram trocadas por outra mais nova.
          const newer = pending.current;
          setOptimistic((o) => {
            const next = { ...o };
            for (const k of Object.keys(patch)) {
              if (!(k in newer)) delete next[k as keyof ProfilePatch];
            }
            return next;
          });
        }
      }
    }
    inflight.current = false;
    if (!mounted.current) return;
    if (Object.keys(failed.current).length > 0) {
      setPhase('error');
    } else {
      setOptimistic({});
      setPhase('saved');
    }
  };

  const save = (patch: ProfilePatch) => {
    // Uma nova escolha substitui a falha anterior da mesma coluna.
    for (const k of Object.keys(patch)) delete failed.current[k as keyof ProfilePatch];
    pending.current = { ...pending.current, ...patch };
    setOptimistic((o) => ({ ...o, ...patch }));
    void pump();
  };

  const retry = () => {
    const patch = failed.current;
    failed.current = {};
    save(patch);
  };

  const value = <K extends keyof ProfilePatch>(key: K): Profile[K] =>
    key in optimistic ? (optimistic[key] as Profile[K]) : profile[key];

  const status =
    phase === 'saving' ? (
      <p role="status" className="text-sm text-muted-foreground">
        Salvando…
      </p>
    ) : phase === 'error' ? (
      <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-error">
        <span>{errorMessage}</span>
        <Button type="button" variant="outline" className="h-11" onClick={retry}>
          Tentar novamente
        </Button>
      </div>
    ) : phase === 'saved' ? (
      <p role="status" className="text-sm font-medium text-success-foreground">
        Salvo
      </p>
    ) : (
      <p role="status" className="sr-only" />
    );
  return { save, value, status };
}
