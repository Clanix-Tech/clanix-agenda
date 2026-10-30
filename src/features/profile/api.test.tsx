import { act, waitFor } from '@testing-library/react';
import { renderHookWithProviders } from '@/test/render';
import { createFakeSupabase, makeSession } from '@/test/fakeSupabase';
import { useBusinessHours, useSetBusinessHours } from '@/features/business-hours/api';
import { useProfile, useUpdateProfile } from './api';

const profile = {
  id: 'user-1',
  display_name: 'Camila',
  business_name: null,
  timezone: 'America/Sao_Paulo',
  default_duration_minutes: 60,
  slot_interval_minutes: 30,
  week_starts_on: 0,
  default_view: 'day',
  reminder_minutes: null,
  hide_client_name_in_notifications: false,
};

describe('perfil', () => {
  it('useProfile le a linha do usuario atual', async () => {
    const fake = createFakeSupabase({
      session: makeSession(),
      tables: { profiles: [{ ...profile, id: 'outro', display_name: 'X' }, profile] },
    });
    const { result } = renderHookWithProviders(() => useProfile(), { supabase: fake });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.display_name).toBe('Camila');
  });

  it('useUpdateProfile envia so colunas permitidas, nunca id', async () => {
    const fake = createFakeSupabase({ session: makeSession(), tables: { profiles: [profile] } });
    const { result } = renderHookWithProviders(
      () => ({ profile: useProfile(), update: useUpdateProfile() }),
      { supabase: fake },
    );
    await waitFor(() => expect(result.current.profile.isSuccess).toBe(true));
    await act(async () => {
      await result.current.update.mutateAsync({
        id: 'hack',
        created_at: 'x',
        display_name: 'Nova',
        timezone: 'America/Manaus',
      } as never);
    });
    const row = fake.tables.profiles![0]!;
    expect(row.display_name).toBe('Nova');
    expect(row.timezone).toBe('America/Manaus');
    expect(row.id).toBe('user-1');
    expect(row.created_at).toBeUndefined();
  });
});

describe('horarios', () => {
  it('useBusinessHours normaliza para HH:mm e ordena', async () => {
    const fake = createFakeSupabase({
      session: makeSession(),
      tables: {
        business_hours: [
          { weekday: 2, start_time: '13:00:00', end_time: '18:00:00' },
          { weekday: 1, start_time: '13:00:00', end_time: '18:00:00' },
          { weekday: 1, start_time: '09:00:00', end_time: '12:00:00' },
        ],
      },
    });
    const { result } = renderHookWithProviders(() => useBusinessHours(), { supabase: fake });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      { weekday: 1, start_time: '09:00', end_time: '12:00' },
      { weekday: 1, start_time: '13:00', end_time: '18:00' },
      { weekday: 2, start_time: '13:00', end_time: '18:00' },
    ]);
  });

  it('useSetBusinessHours chama set_business_hours com p_shifts', async () => {
    const fake = createFakeSupabase({
      session: makeSession(),
      rpc: { set_business_hours: () => ({ data: [] }) },
    });
    const { result } = renderHookWithProviders(() => useSetBusinessHours(), { supabase: fake });
    const shifts = [{ weekday: 1, start_time: '09:00', end_time: '12:00' }];
    await act(async () => {
      await result.current.mutateAsync(shifts);
    });
    expect(fake.calls.rpc[0]).toEqual({ name: 'set_business_hours', args: { p_shifts: shifts } });
  });
});
