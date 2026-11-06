import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Ban, Bell, BellOff, CircleCheck, Info, Share, SquarePlus } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { Profile } from '@/features/profile/api';
import { usePushDevice } from '@/features/notifications/usePushDevice';
import { ChoiceGroup, PRIMARY_BTN, SectionCard } from './shared';
import { useAutoSaveProfile } from './useAutoSaveProfile';

const REMINDERS = [
  { value: 0, label: 'Desligado' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hora' },
];

/** Mesmo formato do lembrete real (título e corpo gerados pelo banco). */
function previewBody(minutes: number, hideName: boolean): string {
  const when = minutes === 60 ? 'em 1 hora' : `em ${minutes} min`;
  return hideName
    ? `Atendimento às 14:00 · ${when}`
    : `14:00 · Juliana Rocha — Escova e hidratação · ${when}`;
}

export function NotificationsSection({ profile }: { profile: Profile }) {
  const { save, value, status } = useAutoSaveProfile(profile);
  const device = usePushDevice();
  const minutes = value('reminder_minutes');
  const hide = value('hide_client_name_in_notifications');
  const canTest = device.configured && device.state === 'ativado';

  return (
    <SectionCard title="Notificações" description="Cada escolha é salva na hora.">
      <div className="flex max-w-xl flex-col gap-5">
        <ThisDevice device={device} />
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
        <div role="group" aria-label="Prévia do lembrete" className="flex flex-col gap-2">
          <p className="text-xs font-bold tracking-wide text-[#475569] uppercase">Prévia</p>
          {minutes === null ? (
            <p className="rounded-[18px] border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-[15px] text-[#475569]">
              Os lembretes estão desligados.
            </p>
          ) : (
            <div className="flex gap-2.5 rounded-[18px] border border-[#E2E8F0] bg-white/85 p-3">
              <Logo variant="icon" size={36} />
              <div className="min-w-0 flex-1 text-sm leading-snug text-[#0F172A]">
                <div className="flex justify-between text-xs text-[#64748B]">
                  <span className="font-semibold text-[#0F172A]">Clanix Agenda</span>
                  <span>agora</span>
                </div>
                <p className="font-semibold">Lembrete de atendimento</p>
                <p>{previewBody(minutes, hide)}</p>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Button
            type="button"
            variant="outline"
            disabled={!canTest || device.busy}
            onClick={device.sendTest}
            className="h-12 rounded-[14px] border-[#E2E8F0] text-sm font-semibold text-[#0F2D5B] disabled:bg-[#F1F5F9] disabled:text-[#64748B] disabled:opacity-100"
          >
            Enviar notificação de teste
          </Button>
          {!canTest && (
            <p className="text-center text-xs text-[#64748B]">
              Disponível depois de ativar neste aparelho.
            </p>
          )}
        </div>
        <Link
          to="/instalar"
          className="inline-flex min-h-11 items-center self-start rounded-lg text-[15px] font-semibold text-[#1D4ED8] underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-[#3B82F6]/50"
        >
          Instalar o app
        </Link>
        {status}
      </div>
    </SectionCard>
  );
}

type Device = ReturnType<typeof usePushDevice>;

/** Cartão "Neste aparelho": o estado real do navegador e a única ação que funciona nele. */
function ThisDevice({ device }: { device: Device }) {
  if (device.state === 'iphone-instalar' && device.configured) return <InstallOnIPhone />;

  let body: ReactNode;
  if (!device.configured) {
    body = (
      <DeviceStatus icon={<Info />} tone="neutral">
        Os lembretes ainda não foram configurados neste ambiente.
      </DeviceStatus>
    );
  } else if (device.state === null) {
    body = device.error ? (
      <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-[#B91C1C]">
        <span>{device.error}</span>
        <Button type="button" variant="outline" className="h-11" onClick={device.refresh}>
          Tentar novamente
        </Button>
      </div>
    ) : (
      <p role="status" className="text-[15px] text-[#475569]">
        Verificando este aparelho…
      </p>
    );
  } else if (device.state === 'ativado') {
    body = (
      <>
        <DeviceStatus icon={<CircleCheck />} tone="ok">
          Lembretes ativados neste aparelho
        </DeviceStatus>
        <Button
          type="button"
          variant="outline"
          disabled={device.busy}
          onClick={device.deactivate}
          className="h-11 self-start px-5 font-semibold text-[#0F2D5B]"
        >
          Desativar neste aparelho
        </Button>
      </>
    );
  } else if (device.state === 'desativado') {
    body = (
      <>
        <DeviceStatus icon={<BellOff />} tone="neutral">
          Lembretes desativados neste aparelho
        </DeviceStatus>
        <Button
          type="button"
          disabled={device.busy}
          onClick={device.activate}
          className={`${PRIMARY_BTN} self-start`}
        >
          {device.busy ? 'Ativando…' : 'Ativar neste aparelho'}
        </Button>
      </>
    );
  } else if (device.state === 'bloqueado') {
    body = (
      <>
        <DeviceStatus icon={<Ban />} tone="danger">
          Notificações bloqueadas neste navegador
        </DeviceStatus>
        <p className="text-sm text-[#475569]">
          Para liberar, abra as configurações do navegador para este site (no iPhone: Ajustes ›
          Notificações › Clanix Agenda), permita as notificações e volte a esta tela.
        </p>
      </>
    );
  } else {
    body = (
      <DeviceStatus icon={<Info />} tone="neutral">
        Este navegador não recebe notificações.
      </DeviceStatus>
    );
  }

  return (
    <section
      aria-labelledby="neste-aparelho"
      className="flex flex-col gap-3 rounded-[18px] border border-[#E2E8F0] bg-white p-4"
    >
      <h3 id="neste-aparelho" className="font-display text-[15px] font-bold text-[#0F2D5B]">
        Neste aparelho
      </h3>
      {body}
      {device.state !== null && device.error && (
        <p role="alert" className="text-sm text-[#B91C1C]">
          {device.error}
        </p>
      )}
    </section>
  );
}

const TONES = {
  ok: 'text-[#166534]',
  neutral: 'text-[#334155]',
  danger: 'text-[#B91C1C]',
} as const;

/** Status com ícone + texto + cor. */
function DeviceStatus({
  icon,
  tone,
  children,
}: {
  icon: ReactNode;
  tone: keyof typeof TONES;
  children: ReactNode;
}) {
  return (
    <p
      className={`flex items-center gap-2 text-[15px] font-semibold [&_svg]:size-5 [&_svg]:shrink-0 ${TONES[tone]}`}
    >
      {icon}
      {children}
    </p>
  );
}

/** Guia do T09: no iPhone, Web Push só funciona no app instalado na Tela de Início. */
function InstallOnIPhone() {
  const step = 'flex items-start gap-3 text-sm leading-snug text-[#0F172A]';
  const badge =
    'font-display grid size-7 shrink-0 place-items-center rounded-[9px] bg-[#0F2D5B] text-sm font-extrabold text-white';
  const inline = 'ml-1 inline size-4 align-[-3px] text-[#1D4ED8]';
  return (
    <section
      aria-labelledby="instalar-iphone"
      className="flex flex-col gap-3.5 rounded-[18px] border border-[#BFDBFE] bg-[#E7F1FF] p-4"
    >
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-white text-[#1D4ED8]">
          <Bell className="size-5" aria-hidden="true" />
        </span>
        <h3
          id="instalar-iphone"
          className="font-display text-base leading-tight font-extrabold text-[#0F2D5B]"
        >
          No iPhone, instale o app para receber lembretes
        </h3>
      </div>
      <ol className="flex flex-col gap-3.5">
        <li className={step}>
          <span className={badge} aria-hidden="true">
            1
          </span>
          <span>
            No Safari, toque em <b>Compartilhar</b>
            <Share className={inline} aria-hidden="true" /> na barra inferior.
          </span>
        </li>
        <li className={step}>
          <span className={badge} aria-hidden="true">
            2
          </span>
          <span>
            Escolha <b>Adicionar à Tela de Início</b>
            <SquarePlus className={inline} aria-hidden="true" />.
          </span>
        </li>
        <li className={step}>
          <span className={badge} aria-hidden="true">
            3
          </span>
          <span>
            Abra o <b>Clanix Agenda</b> pelo ícone e volte aqui para ativar.
          </span>
        </li>
      </ol>
    </section>
  );
}
