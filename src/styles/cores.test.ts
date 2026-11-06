import { describe, expect, it } from 'vitest';

// Guarda de cores: o app só usa tokens semânticos (bg-background, text-foreground…), nunca hex solto,
// paleta do Tailwind ou os nomes antigos (navy, brand, soft, line, canvas, muted-surface).

/** Arquivos que legitimamente guardam cor literal. */
const PERMITIDOS = new Set<string>([
  // THEME_COLORS: cor do <meta name="theme-color">, que não aceita variável CSS.
  'src/lib/theme.ts',
  // Paleta de cores dos serviços favoritos: dado do usuário, validada por contraste (Tarefa 7).
  'src/features/favorites/colors.ts',
]);

/** Ainda não migrados; as tarefas seguintes encolhem esta lista. */
// Logo.tsx: a Tarefa 3 o reescreve com os SVG oficiais.
const PENDENTES = new Set<string>([
  'src/features/account/DeleteAccountDialog.tsx',
  'src/features/appointments/components/AppointmentForm.tsx',
  'src/features/appointments/components/AppointmentSheet.tsx',
  'src/features/appointments/components/CancelDialog.tsx',
  'src/features/appointments/components/ConflictPanel.tsx',
  'src/features/appointments/components/HistoryList.tsx',
  'src/features/appointments/components/StatusActions.tsx',
  'src/features/appointments/domain/status.ts',
  'src/features/appointments/pages/ReschedulePage.tsx',
  'src/features/calendar/components/AgendaToolbar.tsx',
  'src/features/calendar/components/NowLine.tsx',
  'src/features/calendar/components/StatusFilter.tsx',
  'src/features/calendar/components/ViewSwitcher.tsx',
  'src/features/calendar/pages/AgendaPage.tsx',
  'src/features/calendar/views/DayView.tsx',
  'src/features/calendar/views/ListView.tsx',
  'src/features/calendar/views/MonthView.tsx',
  'src/features/calendar/views/WeekView.tsx',
  'src/features/dashboard/DashboardPage.tsx',
  'src/features/history/HistoryPage.tsx',
  'src/features/settings/SettingsPage.tsx',
  'src/features/settings/sections/AccountSection.tsx',
  'src/features/settings/sections/AgendaPrefsSection.tsx',
  'src/features/settings/sections/FavoritesSection.tsx',
  'src/features/settings/sections/HoursSection.tsx',
  'src/features/settings/sections/NotificationsSection.tsx',
  'src/features/settings/sections/ProfileSection.tsx',
  'src/features/settings/sections/shared.tsx',
  'src/features/settings/sections/useAutoSaveProfile.tsx',
]);

const PADROES: RegExp[] = [
  /#[0-9A-Fa-f]{3,8}\b/,
  /\b(bg|text|border|ring|outline|from|via|to|fill|stroke|divide|decoration|placeholder)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/,
  /\b(rgba?|hsla?)\(/,
  /\b(bg|text|border)-(white|black)\b/,
  /\b(bg|text|border)-(navy|brand|brand-strong|soft|line|canvas|muted-surface)\b/,
];

// Código-fonte como texto (não roda): tudo em src exceto testes, tipos gerados e utilitários de teste.
const fontes = import.meta.glob<string>(
  ['/src/**/*.{ts,tsx}', '!/src/**/*.test.*', '!/src/types/**', '!/src/test/**'],
  { query: '?raw', import: 'default', eager: true },
);

const arquivos = Object.keys(fontes).map((f) => f.slice(1));

function reprovaTexto(texto: string): boolean {
  return PADROES.some((re) => re.test(texto));
}

function reprova(arquivo: string): boolean {
  return reprovaTexto(fontes[`/${arquivo}`] ?? '');
}

/** Anel de foco com alfa (`focus-visible:ring-<token>/<n>`): fica abaixo de 3:1 em controles sem borda sólida. */
const ANEL_COM_ALFA = /\bfocus(?:-visible|-within)?:ring-[\w-]+\/\d+/;

describe('guarda de cores', () => {
  it('detecta cores literais (fixtures)', () => {
    for (const ruim of [
      "'rgba(0,0,0,.5)'",
      "'rgb(1 2 3)'",
      "'hsl(10, 50%, 50%)'",
      "'hsla(10, 50%, 50%, .5)'",
      "'#fff'",
      "'bg-white'",
    ]) {
      expect(reprovaTexto(ruim), ruim).toBe(true);
    }
    expect(reprovaTexto("'bg-primary text-foreground'")).toBe(false);
  });

  it('detecta anel de foco com alfa (fixtures)', () => {
    expect(ANEL_COM_ALFA.test('focus-visible:ring-destructive/25')).toBe(true);
    expect(ANEL_COM_ALFA.test('focus:ring-ring/50')).toBe(true);
    expect(ANEL_COM_ALFA.test('focus-visible:ring-ring')).toBe(false);
    expect(ANEL_COM_ALFA.test('aria-invalid:ring-destructive/20')).toBe(false);
  });

  it('nenhum arquivo fora de PERMITIDOS e PENDENTES usa cor literal', () => {
    const ruins = arquivos.filter((f) => !PERMITIDOS.has(f) && !PENDENTES.has(f) && reprova(f));
    expect(ruins).toEqual([]);
  });

  it('PENDENTES só lista arquivos que ainda reprovam (tire da lista os limpos)', () => {
    const limpos = [...PENDENTES].filter((f) => !arquivos.includes(f) || !reprova(f));
    expect(limpos).toEqual([]);
  });

  it('anel de foco opaco (sem alfa) fora de input, select e textarea (PENDENTES migram nas suas tarefas)', () => {
    // Controles sem borda sólida precisam do anel a 3:1; só os campos usam o halo, porque a borda `border-ring` é o indicador.
    const campos = new Set([
      'src/components/ui/input.tsx',
      'src/components/ui/select.tsx',
      'src/components/ui/textarea.tsx',
    ]);
    const ruins = arquivos.filter(
      (f) => !campos.has(f) && !PENDENTES.has(f) && ANEL_COM_ALFA.test(fontes[`/${f}`] ?? ''),
    );
    expect(ruins).toEqual([]);
  });
});
