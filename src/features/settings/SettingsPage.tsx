import { useCallback, useState } from 'react';
import { Link, Navigate, useBlocker, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/useMediaQuery';
import { useProfile } from '@/features/profile/api';
import { AccountSection } from './sections/AccountSection';
import { AgendaPrefsSection } from './sections/AgendaPrefsSection';
import { FavoritesSection } from './sections/FavoritesSection';
import { HoursSection } from './sections/HoursSection';
import { NotificationsSection } from './sections/NotificationsSection';
import { ProfileSection } from './sections/ProfileSection';

const SECTIONS = [
  { slug: 'perfil', label: 'Perfil' },
  { slug: 'expediente', label: 'Expediente' },
  { slug: 'agenda', label: 'Agenda' },
  { slug: 'servicos', label: 'Serviços favoritos' },
  { slug: 'notificacoes', label: 'Notificações' },
  { slug: 'conta', label: 'Conta e privacidade' },
] as const;

type Slug = (typeof SECTIONS)[number]['slug'];

export default function SettingsPage() {
  const { secao } = useParams();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const profile = useProfile();
  const [dirty, setDirty] = useState(false);
  const onDirtyChange = useCallback((d: boolean) => setDirty(d), []);

  // Só Perfil e Expediente têm edição pendente; trocar de seção (ou sair de Ajustes) pergunta antes.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );

  const known = SECTIONS.some((s) => s.slug === secao);
  if (secao && !known) return <Navigate to="/ajustes" replace />;

  const current: Slug | null = (secao as Slug | undefined) ?? (isDesktop ? 'perfil' : null);

  const renderSection = () => {
    if (current === 'servicos') return <FavoritesSection />;
    if (current === 'expediente') return <HoursSection onDirtyChange={onDirtyChange} />;
    if (profile.isPending) return <LoadingState label="Carregando…" />;
    if (profile.isError) {
      return (
        <ErrorState
          message="Não foi possível carregar seus ajustes."
          onRetry={() => void profile.refetch()}
        />
      );
    }
    switch (current) {
      case 'perfil':
        return <ProfileSection profile={profile.data} onDirtyChange={onDirtyChange} />;
      case 'agenda':
        return <AgendaPrefsSection profile={profile.data} />;
      case 'notificacoes':
        return <NotificationsSection profile={profile.data} />;
      case 'conta':
        return <AccountSection profile={profile.data} />;
      default:
        return null;
    }
  };

  const nav = (
    <nav
      aria-label="Seções de ajustes"
      className={
        isDesktop
          ? 'flex w-64 shrink-0 flex-col gap-1 self-start rounded-2xl border border-[#E2E8F0] bg-white p-2'
          : 'flex flex-col gap-2'
      }
    >
      {SECTIONS.map((s) => (
        <Link
          key={s.slug}
          to={`/ajustes/${s.slug}`}
          aria-current={current === s.slug ? 'page' : undefined}
          className={
            isDesktop
              ? 'flex min-h-11 items-center rounded-lg px-3 text-[15px] font-semibold text-[#334155] hover:bg-[#F1F5F9] aria-[current=page]:bg-[#E7F1FF] aria-[current=page]:text-[#1D4ED8]'
              : 'flex min-h-14 items-center justify-between rounded-xl border border-[#E2E8F0] bg-white px-4 text-base font-semibold text-[#0F2D5B]'
          }
        >
          {s.label}
          {!isDesktop && (
            <span aria-hidden="true" className="text-[#64748B]">
              ›
            </span>
          )}
        </Link>
      ))}
    </nav>
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 lg:p-8">
      <h1 className="font-[Manrope] text-[26px] font-extrabold text-[#0F2D5B]">Ajustes</h1>
      {isDesktop ? (
        <div className="flex items-start gap-6">
          {nav}
          <div className="min-w-0 flex-1">{renderSection()}</div>
        </div>
      ) : current ? (
        <>
          <Link
            to="/ajustes"
            aria-label="Voltar para Ajustes"
            className="inline-flex min-h-11 w-fit items-center gap-1 text-[15px] font-semibold text-[#1D4ED8]"
          >
            <span aria-hidden="true">‹</span> Ajustes
          </Link>
          {renderSection()}
        </>
      ) : (
        nav
      )}

      <Dialog open={blocker.state === 'blocked'}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Descartar alterações?</DialogTitle>
            <DialogDescription>
              Você editou esta seção e ainda não salvou. Se continuar, as alterações serão perdidas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => blocker.state === 'blocked' && blocker.reset()}
            >
              Continuar editando
            </Button>
            <Button
              type="button"
              className="h-11 bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
              onClick={() => blocker.state === 'blocked' && blocker.proceed()}
            >
              Descartar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
