import { Switch } from '@/components/ui/switch';
import type { Profile } from '@/features/profile/api';
import { ChoiceGroup, SectionCard } from './shared';
import { useAutoSaveProfile } from './useAutoSaveProfile';

const REMINDERS = [
  { value: 0, label: 'Desligado' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hora' },
];

export function NotificationsSection({ profile }: { profile: Profile }) {
  const { save, value, status } = useAutoSaveProfile(profile);
  const minutes = value('reminder_minutes');
  const hide = value('hide_client_name_in_notifications');
  const when = minutes === 60 ? '1 hora' : `${minutes} min`;

  return (
    <SectionCard title="Notificações" description="Cada escolha é salva na hora.">
      <div className="flex max-w-xl flex-col gap-5">
        <ChoiceGroup
          legend="Lembrar antes do atendimento"
          name="lembrete"
          value={minutes ?? 0}
          options={REMINDERS}
          onChange={(v) => save({ reminder_minutes: v === 0 ? null : v })}
        />
        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
          <span className="text-[15px] font-medium text-[#0F172A]">
            Ocultar nome do cliente na tela de bloqueio
          </span>
          <Switch
            checked={hide}
            onCheckedChange={(on) => save({ hide_client_name_in_notifications: on })}
            aria-label="Ocultar nome do cliente na tela de bloqueio"
          />
        </label>
        <div
          role="group"
          aria-label="Prévia do lembrete"
          className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4"
        >
          <p className="text-xs font-semibold tracking-wide text-[#64748B] uppercase">Prévia</p>
          {minutes === null ? (
            <p className="mt-2 text-[15px] text-[#475569]">Os lembretes estão desligados.</p>
          ) : (
            <div className="mt-2 rounded-lg bg-white p-3 shadow-sm">
              <p className="text-sm font-bold text-[#0F2D5B]">Agenda em Ordem</p>
              <p className="text-[15px] text-[#0F172A]">
                {hide ? `Você tem um atendimento em ${when}.` : `Maria Souza — Corte em ${when}.`}
              </p>
            </div>
          )}
        </div>
        <p className="text-sm text-[#64748B]">
          A ativação neste aparelho chega na próxima atualização.
        </p>
        {status}
      </div>
    </SectionCard>
  );
}
