import { Link, NavLink } from 'react-router';
import { Plus } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/api';
import { useNewAppointment } from '@/features/appointments/components/NewAppointmentProvider';
import { NAV_ITEMS } from './navItems';

/** Inicial do nome do perfil; sem nome, a do e-mail. */
function initial(displayName: string | null | undefined, email: string | undefined): string {
  const source = displayName?.trim() || email?.trim();
  return (source?.[0] ?? '?').toUpperCase();
}

export function SideRail() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { open } = useNewAppointment();
  return (
    <aside
      data-testid="side-rail"
      className="sticky top-0 flex h-screen w-24 shrink-0 flex-col items-center gap-5 border-r border-border bg-card px-4 py-5"
    >
      <Logo variant="icon" size={44} />
      <nav aria-label="Navegação principal" className="flex flex-col items-center gap-5">
        <button
          type="button"
          aria-label="Novo agendamento"
          onClick={() => open()}
          className="grid size-[52px] place-items-center rounded-2xl bg-gradient-fab text-primary-foreground shadow-glow outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
        >
          <Plus aria-hidden="true" className="size-6" />
        </button>
        <div className="flex flex-col gap-1.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-14 w-16 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring ${
                  isActive
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`
              }
            >
              <Icon aria-hidden="true" className="size-[22px]" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
      {/* Link simples: só o item "Ajustes" da navegação marca a página atual. */}
      <Link
        to="/ajustes"
        aria-label="Minha conta"
        className="mt-auto grid size-11 place-items-center rounded-[14px] bg-secondary font-display font-bold text-secondary-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
      >
        {initial(profile?.display_name, user?.email)}
      </Link>
    </aside>
  );
}
