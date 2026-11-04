import { Link, NavLink } from 'react-router';
import { Plus } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { useAuth } from '@/features/auth/AuthProvider';
import { useNewAppointment } from '@/features/appointments/components/NewAppointmentProvider';
import { NAV_ITEMS } from './navItems';

function initials(email: string | undefined): string {
  return (email?.trim()[0] ?? '?').toUpperCase();
}

export function SideRail() {
  const { user } = useAuth();
  const { open } = useNewAppointment();
  return (
    <aside
      data-testid="side-rail"
      className="sticky top-0 flex h-screen w-24 shrink-0 flex-col items-center gap-5 border-r border-[#E2E8F0] bg-white px-4 py-5"
    >
      <Logo variant="icon" size={44} />
      <nav aria-label="Navegação principal" className="flex flex-col items-center gap-5">
        <button
          type="button"
          aria-label="Novo agendamento"
          onClick={() => open()}
          className="grid size-[52px] place-items-center rounded-2xl bg-[#2563EB] text-white outline-none hover:bg-[#1D4ED8] focus-visible:ring-[3px] focus-visible:ring-[#3B82F6]/50"
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
                `flex min-h-14 w-16 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-[#3B82F6]/50 ${
                  isActive ? 'bg-[#E7F1FF] text-[#0F2D5B]' : 'text-[#64748B] hover:bg-[#F8FAFC]'
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
        className="mt-auto grid size-11 place-items-center rounded-[14px] bg-[#E7F1FF] font-display font-extrabold text-[#0F2D5B] outline-none focus-visible:ring-[3px] focus-visible:ring-[#3B82F6]/50"
      >
        {initials(user?.email)}
      </Link>
    </aside>
  );
}
