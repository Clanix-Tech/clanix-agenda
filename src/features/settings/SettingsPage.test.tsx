import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { vi } from 'vitest';
import { toast } from 'sonner';
import { renderWithProviders, setViewportWidth } from '@/test/render';
import {
  createFakeSupabase,
  makeSession,
  type FakeSupabaseOptions,
  type Row,
} from '@/test/fakeSupabase';
import SettingsPage from './SettingsPage';

// Ambiente com a chave VAPID configurada (independe dos arquivos .env da máquina).
vi.mock('@/lib/env', () => ({
  getEnv: () => ({
    supabaseUrl: 'http://supabase.test',
    supabasePublishableKey: 'chave',
    vapidPublicKey:
      'BF2IWmoBx0EqrHwWhvvhWgH6G6eLaBFm8rTIuhMdhVA3PD0xGejXlybumP1Xy6_Xb4pdTnYaVlmvX6CzSk9oaMI',
  }),
}));

vi.mock('sonner', async (importOriginal) => {
  const mod = await importOriginal<typeof import('sonner')>();
  return { ...mod, toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) };
});

const PROFILE: Row = {
  id: 'user-1',
  display_name: 'Marina',
  business_name: 'Studio M',
  timezone: 'America/Sao_Paulo',
  default_duration_minutes: 60,
  slot_interval_minutes: 30,
  week_starts_on: 1,
  default_view: 'semana',
  reminder_minutes: null,
  hide_client_name_in_notifications: false,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
};

const HOURS: Row[] = [
  { weekday: 1, start_time: '09:00:00', end_time: '18:00:00' },
  { weekday: 2, start_time: '09:00:00', end_time: '18:00:00' },
];

function Where() {
  const loc = useLocation();
  return <output data-testid="loc">{loc.pathname}</output>;
}

function setup(
  opts: {
    route?: string;
    width?: number;
    rpc?: FakeSupabaseOptions['rpc'];
    auth?: FakeSupabaseOptions['auth'];
    errors?: FakeSupabaseOptions['errors'];
    /** Atraso (ms) de cada gravação do perfil, para provocar sobreposição. */
    updateDelay?: number;
  } = {},
) {
  setViewportWidth(opts.width ?? 1280);
  const fake = createFakeSupabase({
    session: makeSession(),
    tables: {
      profiles: [{ ...PROFILE }],
      business_hours: structuredClone(HOURS),
      favorite_services: [],
      appointments: [],
    },
    rpc: opts.rpc,
    auth: opts.auth,
    errors: opts.errors,
  });
  const updates: Array<{ table: string; values: Row }> = [];
  const stats = { inflight: 0, max: 0 };
  const orig = fake.from.bind(fake);
  fake.from = ((table: string) => {
    const q = orig(table);
    const u = q.update.bind(q);
    q.update = (values: Row) => {
      updates.push({ table, values });
      const res = u(values);
      if (opts.updateDelay) {
        const then = res.then.bind(res);
        res.then = ((a: never, b: never) => {
          stats.inflight++;
          stats.max = Math.max(stats.max, stats.inflight);
          return new Promise((r) => setTimeout(r, opts.updateDelay)).then(() => {
            stats.inflight--;
            return then(a, b);
          });
        }) as typeof res.then;
      }
      return res;
    };
    return q;
  }) as typeof fake.from;
  const view = renderWithProviders(null, {
    supabase: fake,
    route: opts.route ?? '/ajustes/perfil',
    routes: [
      {
        path: '/ajustes/:secao?',
        element: (
          <>
            <SettingsPage />
            <Where />
          </>
        ),
      },
    ],
  });
  return { ...view, fake, updates, stats };
}

beforeEach(() => {
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});

describe('SettingsPage navegação', () => {
  it('no computador mostra a navegação e o Perfil por padrão', async () => {
    setup({ route: '/ajustes' });
    expect(await screen.findByLabelText('Seu nome')).toHaveValue('Marina');
    const nav = screen.getByRole('navigation', { name: 'Seções de ajustes' });
    for (const n of [
      'Perfil',
      'Expediente',
      'Agenda',
      'Serviços favoritos',
      'Notificações',
      'Conta e privacidade',
    ]) {
      expect(within(nav).getByRole('link', { name: n })).toBeInTheDocument();
    }
  });

  it('no celular /ajustes lista as seções e a seção tem botão de voltar', async () => {
    const user = userEvent.setup();
    setup({ route: '/ajustes', width: 390 });
    await user.click(await screen.findByRole('link', { name: 'Notificações' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/ajustes/notificacoes');
    await user.click(await screen.findByRole('link', { name: /Voltar para Ajustes/ }));
    expect(screen.getByTestId('loc')).toHaveTextContent(/^\/ajustes$/);
  });

  it('seção desconhecida volta para /ajustes', async () => {
    setup({ route: '/ajustes/xyz' });
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent(/^\/ajustes$/));
  });

  it('trocar de seção com edição não salva pede confirmação', async () => {
    const user = userEvent.setup();
    setup();
    const name = await screen.findByLabelText('Seu nome');
    await user.type(name, 'X');
    await user.click(screen.getByRole('link', { name: 'Agenda' }));
    expect(await screen.findByText('Descartar alterações?')).toBeInTheDocument();
    expect(screen.getByTestId('loc')).toHaveTextContent('/ajustes/perfil');
    await user.click(screen.getByRole('button', { name: 'Continuar editando' }));
    expect(screen.getByLabelText('Seu nome')).toHaveValue('MarinaX');
    await user.click(screen.getByRole('link', { name: 'Agenda' }));
    await user.click(await screen.findByRole('button', { name: 'Descartar' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/ajustes/agenda');
  });

  it('sem edição troca de seção direto', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByLabelText('Seu nome');
    await user.click(screen.getByRole('link', { name: 'Agenda' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/ajustes/agenda');
  });
});

describe('Perfil', () => {
  it('salva só as colunas permitidas (sem id) e avisa', async () => {
    const user = userEvent.setup();
    const { updates, fake } = setup();
    const name = await screen.findByLabelText('Seu nome');
    await user.clear(name);
    await user.type(name, 'Camila');
    await user.click(screen.getByRole('button', { name: 'Salvar perfil' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Alterações salvas'));
    expect(updates).toHaveLength(1);
    const keys = Object.keys(updates[0]!.values);
    expect(keys).not.toContain('id');
    expect(keys).not.toContain('created_at');
    expect(updates[0]!.values.display_name).toBe('Camila');
    expect(fake.tables.profiles![0]!.display_name).toBe('Camila');
  });

  it('nome vazio não salva', async () => {
    const user = userEvent.setup();
    const { updates } = setup();
    const name = await screen.findByLabelText('Seu nome');
    await user.clear(name);
    await user.click(screen.getByRole('button', { name: 'Salvar perfil' }));
    expect(await screen.findByText('Informe seu nome (até 80 caracteres).')).toBeInTheDocument();
    expect(updates).toHaveLength(0);
  });

  it('duplo clique em Salvar grava uma vez', async () => {
    const user = userEvent.setup();
    const { updates } = setup();
    const name = await screen.findByLabelText('Seu nome');
    await user.type(name, 'a');
    await user.dblClick(screen.getByRole('button', { name: 'Salvar perfil' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(updates).toHaveLength(1);
  });
});

describe('Agenda', () => {
  it('trocar a visão inicial para Lista grava default_view lista', async () => {
    const user = userEvent.setup();
    const { fake } = setup({ route: '/ajustes/agenda' });
    await user.click(await screen.findByRole('radio', { name: 'Lista' }));
    await waitFor(() => expect(fake.tables.profiles![0]!.default_view).toBe('lista'));
    expect(await screen.findByText('Salvo')).toBeInTheDocument();
  });

  it('grade e primeiro dia da semana gravam', async () => {
    const user = userEvent.setup();
    const { fake } = setup({ route: '/ajustes/agenda' });
    await user.click(await screen.findByRole('radio', { name: '15 min' }));
    await waitFor(() => expect(fake.tables.profiles![0]!.slot_interval_minutes).toBe(15));
    await user.click(screen.getByRole('radio', { name: 'Domingo' }));
    await waitFor(() => expect(fake.tables.profiles![0]!.week_starts_on).toBe(0));
  });

  it('duração fora de 5–480 não grava; válida grava ao sair do campo', async () => {
    const user = userEvent.setup();
    const { fake, updates } = setup({ route: '/ajustes/agenda' });
    const input = await screen.findByLabelText('Duração padrão (minutos)');
    await user.clear(input);
    await user.type(input, '3');
    await user.tab();
    expect(await screen.findByText('Informe de 5 a 480 minutos.')).toBeInTheDocument();
    expect(updates).toHaveLength(0);
    await user.clear(input);
    await user.type(input, '45');
    await user.tab();
    await waitFor(() => expect(fake.tables.profiles![0]!.default_duration_minutes).toBe(45));
  });
});

describe('Agenda: gravações em sequência', () => {
  it('dois cliques no mesmo controle: pedidos em ordem, um por vez, vale o último', async () => {
    const user = userEvent.setup();
    const { fake, updates, stats } = setup({ route: '/ajustes/agenda', updateDelay: 150 });
    await user.click(await screen.findByRole('radio', { name: '15 min' }));
    await user.click(screen.getByRole('radio', { name: '60 min' }));
    expect(screen.getByRole('radio', { name: '60 min' })).toBeChecked();
    await waitFor(() => expect(screen.getByText('Salvo')).toBeInTheDocument());
    expect(fake.tables.profiles![0]!.slot_interval_minutes).toBe(60);
    expect(screen.getByRole('radio', { name: '60 min' })).toBeChecked();
    expect(updates.map((u) => u.values.slot_interval_minutes)).toEqual([15, 60]);
    expect(stats.max).toBe(1);
  });

  it('dois controles diferentes em seguida: os dois ficam', async () => {
    const user = userEvent.setup();
    const { fake } = setup({ route: '/ajustes/agenda', updateDelay: 150 });
    await user.click(await screen.findByRole('radio', { name: '15 min' }));
    await user.click(screen.getByRole('radio', { name: 'Domingo' }));
    expect(screen.getByRole('radio', { name: '15 min' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Domingo' })).toBeChecked();
    await waitFor(() => expect(screen.getByText('Salvo')).toBeInTheDocument());
    expect(fake.tables.profiles![0]).toMatchObject({
      slot_interval_minutes: 15,
      week_starts_on: 0,
    });
    expect(screen.getByRole('radio', { name: '15 min' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Domingo' })).toBeChecked();
  });

  it('falha mostra o erro, volta ao valor salvo e Tentar novamente reenvia', async () => {
    const user = userEvent.setup();
    const errors = { profiles: { update: { code: 'XX000' } } };
    const { fake } = setup({ route: '/ajustes/agenda', errors });
    await user.click(await screen.findByRole('radio', { name: 'Lista' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Algo deu errado');
    expect(screen.getByRole('radio', { name: 'Semana' })).toBeChecked();
    delete (errors.profiles as Record<string, unknown>).update;
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(fake.tables.profiles![0]!.default_view).toBe('lista'));
    expect(await screen.findByText('Salvo')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Lista' })).toBeChecked();
  });
});

describe('Agenda: falha depois de sair da seção', () => {
  it('a gravação que falha com a seção já fechada avisa por toast', async () => {
    const user = userEvent.setup();
    const errors = { profiles: { update: { code: 'XX000' } } };
    const { fake } = setup({ route: '/ajustes/agenda', errors });
    // Segura a resposta da gravação até a seção sair da tela (sem depender de tempo).
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const from = fake.from.bind(fake);
    fake.from = ((table: string) => {
      const q = from(table);
      const update = q.update.bind(q);
      q.update = (values: Row) => {
        const res = update(values);
        const then = res.then.bind(res);
        res.then = ((a: never, b: never) => gate.then(() => then(a, b))) as typeof res.then;
        return res;
      };
      return q;
    }) as typeof fake.from;
    await user.click(await screen.findByRole('radio', { name: 'Lista' }));
    await user.click(screen.getByRole('link', { name: 'Perfil' }));
    expect(await screen.findByLabelText('Seu nome')).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
    release();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Não foi possível salvar suas preferências. Algo deu errado. Tente novamente.',
      ),
    );
  });

  it('com a seção aberta o erro fica na tela, sem toast', async () => {
    const user = userEvent.setup();
    setup({ route: '/ajustes/agenda', errors: { profiles: { update: { code: 'XX000' } } } });
    await user.click(await screen.findByRole('radio', { name: 'Lista' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Algo deu errado');
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe('Perfil: fuso e estado de edição', () => {
  it('trocar o fuso invalida também os atendimentos em cache', async () => {
    const user = userEvent.setup();
    const { queryClient } = setup();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await user.selectOptions(await screen.findByLabelText('Fuso horário'), 'America/Manaus');
    await user.click(screen.getByRole('button', { name: 'Salvar perfil' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(spy).toHaveBeenCalledWith({ queryKey: ['appointments'] });
  });

  it('sem trocar o fuso não invalida os atendimentos', async () => {
    const user = userEvent.setup();
    const { queryClient } = setup();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await user.type(await screen.findByLabelText('Seu nome'), 'a');
    await user.click(screen.getByRole('button', { name: 'Salvar perfil' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(spy).not.toHaveBeenCalledWith({ queryKey: ['appointments'] });
  });

  it('durante o envio não pede para descartar', async () => {
    const user = userEvent.setup();
    setup({ updateDelay: 80 });
    await user.type(await screen.findByLabelText('Seu nome'), 'a');
    await user.click(screen.getByRole('button', { name: 'Salvar perfil' }));
    await user.click(screen.getByRole('link', { name: 'Agenda' }));
    expect(screen.queryByText('Descartar alterações?')).not.toBeInTheDocument();
    expect(screen.getByTestId('loc')).toHaveTextContent('/ajustes/agenda');
  });

  it('se o envio falhar, volta a contar como editado', async () => {
    const user = userEvent.setup();
    setup({ errors: { profiles: { update: { code: 'XX000' } } } });
    await user.type(await screen.findByLabelText('Seu nome'), 'a');
    await user.click(screen.getByRole('button', { name: 'Salvar perfil' }));
    await screen.findAllByRole('alert');
    await user.click(screen.getByRole('link', { name: 'Agenda' }));
    expect(await screen.findByText('Descartar alterações?')).toBeInTheDocument();
  });

  it('Esc no aviso cancela a troca de seção', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(await screen.findByLabelText('Seu nome'), 'a');
    await user.click(screen.getByRole('link', { name: 'Agenda' }));
    await screen.findByText('Descartar alterações?');
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByText('Descartar alterações?')).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId('loc')).toHaveTextContent('/ajustes/perfil');
    expect(screen.getByLabelText('Seu nome')).toHaveValue('Marinaa');
  });
});

describe('Expediente', () => {
  it('salva pelo set_business_hours e avisa', async () => {
    const user = userEvent.setup();
    const { fake } = setup({ route: '/ajustes/expediente' });
    await user.click(await screen.findByRole('switch', { name: 'Atender em Quarta' }));
    await user.click(screen.getByRole('button', { name: 'Salvar expediente' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Alterações salvas'));
    const call = fake.calls.rpc.find((c) => c.name === 'set_business_hours')!;
    expect((call.args as { p_shifts: unknown[] }).p_shifts).toHaveLength(3);
  });

  it('22023 mostra mensagem de turnos inválidos e preserva a edição', async () => {
    const user = userEvent.setup();
    setup({
      route: '/ajustes/expediente',
      rpc: { set_business_hours: () => ({ error: { code: '22023' } }) },
    });
    await user.click(await screen.findByRole('switch', { name: 'Atender em Quarta' }));
    await user.click(screen.getByRole('button', { name: 'Salvar expediente' }));
    expect(
      await screen.findByText('Revise os turnos: há horários inválidos ou sobrepostos.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Atender em Quarta' })).toBeChecked();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('Descartar volta ao expediente salvo', async () => {
    const user = userEvent.setup();
    setup({ route: '/ajustes/expediente' });
    await user.click(await screen.findByRole('switch', { name: 'Atender em Quarta' }));
    await user.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(screen.getByRole('switch', { name: 'Atender em Quarta' })).not.toBeChecked();
  });
});

describe('Notificações', () => {
  it('sem service worker (jsdom, como no vite dev) mostra "sem suporte" e nenhum Ativar', async () => {
    setup({ route: '/ajustes/notificacoes' });
    expect(await screen.findByText('Este navegador não recebe notificações.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ativar/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar notificação de teste' })).toBeDisabled();
    expect(screen.queryByText(/próxima atualização/)).not.toBeInTheDocument();
  });

  it('antecedência e ocultar nome gravam no perfil', async () => {
    const user = userEvent.setup();
    const { fake } = setup({ route: '/ajustes/notificacoes' });
    await user.click(await screen.findByRole('radio', { name: '30 min' }));
    await waitFor(() => expect(fake.tables.profiles![0]!.reminder_minutes).toBe(30));
    await user.click(screen.getByRole('radio', { name: 'Desligado' }));
    await waitFor(() => expect(fake.tables.profiles![0]!.reminder_minutes).toBeNull());
    await user.click(
      screen.getByRole('switch', { name: 'Ocultar nome do cliente na tela de bloqueio' }),
    );
    await waitFor(() =>
      expect(fake.tables.profiles![0]!.hide_client_name_in_notifications).toBe(true),
    );
  });
});

describe('Conta e privacidade', () => {
  const passwordSetup = (error?: unknown) => {
    const seen: unknown[] = [];
    const view = setup({
      route: '/ajustes/conta',
      auth: {
        updateUser: (a) => {
          seen.push(a);
          return error ? { error } : {};
        },
      },
    });
    return { ...view, seen };
  };

  const fill = async (a: string, b: string) => {
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Nova senha'), a);
    await user.type(screen.getByLabelText('Confirmar nova senha'), b);
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }));
  };

  it('troca a senha e avisa', async () => {
    const { seen } = passwordSetup();
    await fill('senhaNova1', 'senhaNova1');
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Senha alterada'));
    expect(seen).toEqual([{ password: 'senhaNova1' }]);
  });

  it('senha curta ou diferente não envia', async () => {
    const { seen } = passwordSetup();
    await fill('curta', 'outra');
    expect(
      await screen.findByText('A senha precisa ter pelo menos 8 caracteres.'),
    ).toBeInTheDocument();
    expect(seen).toHaveLength(0);
  });

  it('confirmação diferente não envia', async () => {
    const { seen } = passwordSetup();
    await fill('senhaNova1', 'senhaNova2');
    expect(await screen.findByText('As senhas não são iguais.')).toBeInTheDocument();
    expect(seen).toHaveLength(0);
  });

  it('senha fraca vinda do servidor usa a mensagem do cadastro', async () => {
    passwordSetup({ code: 'weak_password' });
    await fill('senha1234', 'senha1234');
    expect(
      await screen.findByText('A senha precisa ter pelo menos 8 caracteres.'),
    ).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('senha igual à atual tem mensagem própria', async () => {
    passwordSetup({ code: 'same_password' });
    await fill('senha1234', 'senha1234');
    expect(
      await screen.findByText('A nova senha precisa ser diferente da atual.'),
    ).toBeInTheDocument();
  });

  it('Sair encerra a sessão e não oferece exclusão de conta', async () => {
    const user = userEvent.setup();
    const { fake } = setup({ route: '/ajustes/conta' });
    expect(await screen.findByRole('button', { name: 'Baixar meus dados (CSV)' })).toBeEnabled();
    expect(screen.queryByText(/excluir/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(fake.calls.signOut).toHaveLength(1));
  });
});
