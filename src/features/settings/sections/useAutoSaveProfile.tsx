import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useUpdateProfile, type Profile, type ProfilePatch } from '@/features/profile/api';

/** Salvamento imediato de preferências do perfil, com o estado ("Salvando…", "Salvo", erro). */
export function useAutoSaveProfile(profile: Profile) {
  const mutation = useUpdateProfile();
  const last = useRef<ProfilePatch | null>(null);
  const save = (patch: ProfilePatch) => {
    last.current = patch;
    mutation.mutate(patch);
  };
  /** Enquanto grava, mostra o valor escolhido; depois, o do perfil. */
  const value = <K extends keyof ProfilePatch>(key: K): Profile[K] =>
    mutation.isPending && mutation.variables && key in mutation.variables
      ? (mutation.variables[key] as Profile[K])
      : profile[key];
  const status = mutation.isPending ? (
    <p role="status" className="text-sm text-[#64748B]">
      Salvando…
    </p>
  ) : mutation.isError ? (
    <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-[#B91C1C]">
      <span>{mutation.error.message}</span>
      <Button
        type="button"
        variant="outline"
        className="h-11"
        onClick={() => last.current && mutation.mutate(last.current)}
      >
        Tentar novamente
      </Button>
    </div>
  ) : mutation.isSuccess ? (
    <p role="status" className="text-sm font-medium text-[#166534]">
      Salvo
    </p>
  ) : (
    <p role="status" className="sr-only" />
  );
  return { save, value, status };
}
