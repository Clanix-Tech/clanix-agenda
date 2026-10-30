import { NavLink } from 'react-router';
import { Plus } from 'lucide-react';
import { useNewAppointment } from '@/features/appointments/components/NewAppointmentProvider';
import { NAV_ITEMS, type NavItem } from './navItems';

function Item({ to, label, icon: Icon, end }: NavItem) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex min-h-11 flex-col items-center gap-1 pt-1 text-xs font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-[#3B82F6]/50 ${
          isActive ? 'text-[#1D4ED8]' : 'text-[#64748B]'
        }`
      }
    >
      <Icon aria-hidden="true" className="size-[22px]" />
      {label}
    </NavLink>
  );
}

export function BottomNav() {
  const { open } = useNewAppointment();
  const before = NAV_ITEMS.slice(0, 2);
  const after = NAV_ITEMS.slice(2);
  return (
    <nav
      aria-label="Navegação principal"
      data-testid="bottom-nav"
      className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(84px+env(safe-area-inset-bottom))] grid-cols-5 items-start border-t border-[#E2E8F0] bg-white px-2 pt-2 pb-[env(safe-area-inset-bottom)]"
    >
      {before.map((item) => (
        <Item key={item.to} {...item} />
      ))}
      <div className="flex justify-center">
        <button
          type="button"
          aria-label="Novo agendamento"
          onClick={() => open()}
          className="-mt-[26px] grid size-[58px] place-items-center rounded-full border-4 border-[#F8FAFC] bg-[#2563EB] text-white outline-none hover:bg-[#1D4ED8] focus-visible:ring-[3px] focus-visible:ring-[#3B82F6]/50"
        >
          <Plus aria-hidden="true" className="size-[26px]" />
        </button>
      </div>
      {after.map((item) => (
        <Item key={item.to} {...item} />
      ))}
    </nav>
  );
}
