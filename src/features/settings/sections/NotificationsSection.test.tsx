import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { createFakeSupabase, makeSession, type Row } from '@/test/fakeSupabase';
import { useProfile } from '@/features/profile/api';
import type { DeviceState } from '@/features/notifications/push';
import type { usePushDevice } from '@/features/notifications/usePushDevice';
import { NotificationsSection } from './NotificationsSection';

type Device = ReturnType<typeof usePushDevice>;

const device = vi.hoisted(() => ({ current: undefined as unknown as Device }));
vi.mock('@/features/notifications/usePushDevice', () => ({
  usePushDevice: () => device.current,
}));

const PROFILE: Row = {
  id: 'user-1',
  display_name: 'Marina',
  business_name: 'Studio M',
  timezone: 'America/Sao_Paulo',
  default_duration_minutes: 60,
  slot_interval_minutes: 30,
  week_starts_on: 1,
  default_view: 'semana',
  reminder_minutes: 30,
  hide_client_name_in_notifications: false,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
};

function setDevice(state: DeviceState | null, extra: Partial<Device> = {}) {
  device.current = {
    state,
    busy: false,
    error: null,
    configured: true,
    activate: vi.fn(),
    deactivate: vi.fn(),
    sendTest: vi.fn(),
    refresh: vi.fn(),
    ...extra,
  };
  return device.current;
}

/** Como na SettingsPage: o perfil vem da consulta (e é relido depois de cada gravação). */
function WithProfile() {
  const profile = useProfile();
  return profile.data ? <NotificationsSection profile={profile.data} /> : null;
}

async function setup(profile: Partial<Row> = {}) {
  const row = { ...PROFILE, ...profile };
  const fake = createFakeSupabase({ session: makeSession(), tables: { profiles: [row] } });
  const view = renderWithProviders(<WithProfile />, { supabase: fake });
  await screen.findByRole('group', { name: 'Prévia do lembrete' });
  return { ...view, fake };
}

const testButton = () => screen.getByRole('button', { name: 'Enviar notificação de teste' });
const HINT = 'Disponível depois de ativar neste aparelho.';

beforeEach(() => {
  setDevice('desativado');
});

describe('NotificationsSection: neste aparelho', () => {
  it('ativado: mostra o estado, Desativar e o teste habilitado', async () => {
    const user = userEvent.setup();
    const d = setDevice('ativado');
    await setup();
    expect(screen.getByText('Lembretes ativados neste aparelho')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Desativar neste aparelho' }));
    expect(d.deactivate).toHaveBeenCalledTimes(1);
    expect(testButton()).toBeEnabled();
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
    await user.click(testButton());
    expect(d.sendTest).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Ativar neste aparelho' })).not.toBeInTheDocument();
  });

  it('ativado e enviando: o teste fica desabilitado', async () => {
    setDevice('ativado', { busy: true });
    await setup();
    expect(testButton()).toBeDisabled();
  });

  it('desativado: botão Ativar e teste desabilitado com a explicação', async () => {
    const user = userEvent.setup();
    const d = setDevice('desativado');
    await setup();
    await user.click(screen.getByRole('button', { name: 'Ativar neste aparelho' }));
    expect(d.activate).toHaveBeenCalledTimes(1);
    expect(testButton()).toBeDisabled();
    expect(screen.getByText(HINT)).toBeInTheDocument();
  });

  it('desativado e ocupado: Ativar fica desabilitado', async () => {
    setDevice('desativado', { busy: true });
    await setup();
    expect(screen.getByRole('button', { name: /Ativando/ })).toBeDisabled();
  });

  it('bloqueado: explica como liberar e não tem botão de ativar', async () => {
    setDevice('bloqueado');
    await setup();
    expect(screen.getByText('Notificações bloqueadas neste navegador')).toBeInTheDocument();
    expect(screen.getByText(/permita as notificações e volte a esta tela/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ativar/ })).not.toBeInTheDocument();
    expect(testButton()).toBeDisabled();
  });

  it('sem suporte: avisa e não tem botão de ativar', async () => {
    setDevice('sem-suporte');
    await setup();
    expect(screen.getByText('Este navegador não recebe notificações.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ativar/ })).not.toBeInTheDocument();
    expect(testButton()).toBeDisabled();
    expect(screen.getByText(HINT)).toBeInTheDocument();
  });

  it('iPhone sem instalar: guia de 3 passos e nenhum botão de ativar', async () => {
    setDevice('iphone-instalar');
    await setup();
    expect(
      screen.getByRole('heading', { name: 'No iPhone, instale o app para receber lembretes' }),
    ).toBeInTheDocument();
    const steps = screen.getAllByRole('listitem');
    expect(steps).toHaveLength(3);
    expect(steps[0]).toHaveTextContent('No Safari, toque em Compartilhar na barra inferior.');
    expect(steps[1]).toHaveTextContent('Escolha Adicionar à Tela de Início.');
    expect(steps[2]).toHaveTextContent(
      'Abra o Agenda em Ordem pelo ícone e volte aqui para ativar.',
    );
    expect(screen.queryByRole('button', { name: /Ativar/ })).not.toBeInTheDocument();
    expect(testButton()).toBeDisabled();
  });

  it('verificando: mostra que está verificando e nenhum botão de ativar', async () => {
    setDevice(null);
    await setup();
    expect(screen.getByText('Verificando este aparelho…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ativar/ })).not.toBeInTheDocument();
  });

  it('erro aparece como alerta', async () => {
    setDevice('desativado', { error: 'Sem conexão. Nada foi salvo — tente novamente.' });
    await setup();
    expect(screen.getByRole('alert')).toHaveTextContent('Sem conexão. Nada foi salvo');
  });

  it('falha ao verificar o aparelho: alerta com Tentar novamente', async () => {
    const user = userEvent.setup();
    const d = setDevice(null, { error: 'Sem conexão. Nada foi salvo — tente novamente.' });
    await setup();
    expect(screen.queryByText('Verificando este aparelho…')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(d.refresh).toHaveBeenCalled();
  });

  it('sem chave VAPID no ambiente: avisa, sem Ativar, e as preferências continuam editáveis', async () => {
    const user = userEvent.setup();
    setDevice('desativado', { configured: false });
    await setup();
    expect(
      screen.getByText('Os lembretes ainda não foram configurados neste ambiente.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ativar/ })).not.toBeInTheDocument();
    expect(testButton()).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: '15 min' }));
    expect(screen.getByRole('radio', { name: '15 min' })).toBeChecked();
  });

  it('não mostra mais o aviso de "próxima atualização"', async () => {
    await setup();
    expect(screen.queryByText(/próxima atualização/)).not.toBeInTheDocument();
  });
});

describe('NotificationsSection: prévia', () => {
  it('com nome oculto mostra exatamente o texto real', async () => {
    await setup({ hide_client_name_in_notifications: true });
    const preview = screen.getByRole('group', { name: 'Prévia do lembrete' });
    expect(preview).toHaveTextContent('Lembrete de atendimento');
    expect(preview).toHaveTextContent('Atendimento às 14:00 · em 30 min');
    expect(preview).not.toHaveTextContent('Juliana');
  });

  it('com nome visível mostra horário, cliente e serviço', async () => {
    await setup();
    expect(screen.getByRole('group', { name: 'Prévia do lembrete' })).toHaveTextContent(
      '14:00 · Juliana Rocha — Escova e hidratação · em 30 min',
    );
  });

  it('1 hora vira "em 1 hora"', async () => {
    await setup({ reminder_minutes: 60, hide_client_name_in_notifications: true });
    expect(screen.getByRole('group', { name: 'Prévia do lembrete' })).toHaveTextContent(
      'Atendimento às 14:00 · em 1 hora',
    );
  });

  it('trocar a antecedência atualiza a prévia na hora', async () => {
    const user = userEvent.setup();
    await setup({ hide_client_name_in_notifications: true });
    await user.click(screen.getByRole('radio', { name: '15 min' }));
    await waitFor(() =>
      expect(screen.getByRole('group', { name: 'Prévia do lembrete' })).toHaveTextContent(
        'Atendimento às 14:00 · em 15 min',
      ),
    );
  });

  it('desligado mostra que os lembretes estão desligados', async () => {
    await setup({ reminder_minutes: null });
    expect(screen.getByRole('group', { name: 'Prévia do lembrete' })).toHaveTextContent(
      'Os lembretes estão desligados.',
    );
  });
});
