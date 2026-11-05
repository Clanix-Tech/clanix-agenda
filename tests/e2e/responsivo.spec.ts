import type { Locator, Page } from '@playwright/test';
import { detailsSheet, expect, isDesktop, login, mainNav, test } from './support/fixtures.ts';
import { expectNoHorizontalScroll } from './support/layout.ts';
import { LONG_NAME, REALISTIC_USER, seedRealistic } from './support/seed.ts';

const DAYS = [
  { weekday: 1, short: 'Seg', long: 'Segunda' },
  { weekday: 2, short: 'Ter', long: 'Terça' },
  { weekday: 3, short: 'Qua', long: 'Quarta' },
  { weekday: 4, short: 'Qui', long: 'Quinta' },
  { weekday: 5, short: 'Sex', long: 'Sexta' },
  { weekday: 6, short: 'Sáb', long: 'Sábado' },
  { weekday: 0, short: 'Dom', long: 'Domingo' },
];

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/**
 * O interruptor do dia tem área de toque (o `label` que o envolve) de pelo menos 44×44 px,
 * que não encosta nos campos de horário do mesmo dia, e tocar na borda dessa área aciona o switch.
 */
async function checkDaySwitch(page: Page, day: (typeof DAYS)[number]) {
  const card = page.locator(`[data-day="${day.weekday}"]`);
  const sw = card.getByRole('switch', { name: `Atender em ${day.long}` });
  const hit = sw.locator('xpath=ancestor::label[1]');
  const box = (await hit.boundingBox())!;
  expect(box.width, `largura da área do switch de ${day.long}`).toBeGreaterThanOrEqual(44);
  expect(box.height, `altura da área do switch de ${day.long}`).toBeGreaterThanOrEqual(44);

  const times = card.locator('input[type="time"]');
  for (let i = 0; i < (await times.count()); i++) {
    const t = (await times.nth(i).boundingBox())!;
    expect(overlaps(box, t), `switch de ${day.long} invade o horário ${i + 1}`).toBe(false);
  }

  const before = await sw.getAttribute('aria-checked');
  const after = before === 'true' ? 'false' : 'true';
  await hit.click({ position: { x: 2, y: 2 } });
  await expect(sw).toHaveAttribute('aria-checked', after);
  await hit.click({ position: { x: box.width - 2, y: box.height - 2 } });
  await expect(sw).toHaveAttribute('aria-checked', before!);
}

test('navegação: inferior no celular, barra lateral no computador', async ({ page, makeUser }) => {
  const user = await makeUser();
  await login(page, user);
  await expect(mainNav(page)).toBeVisible();
  if (isDesktop(page)) {
    await expect(page.getByTestId('side-rail')).toBeVisible();
    await expect(page.getByTestId('bottom-nav')).toHaveCount(0);
  } else {
    await expect(page.getByTestId('bottom-nav')).toBeVisible();
    await expect(page.getByTestId('side-rail')).toHaveCount(0);
  }
  for (const label of ['Início', 'Agenda', 'Histórico', 'Ajustes']) {
    await expect(mainNav(page).getByRole('link', { name: label })).toBeVisible();
  }
});

test('nenhuma página rola na horizontal (com nome de 120 caracteres)', async ({
  page,
  makeUser,
}) => {
  const user = await makeUser(REALISTIC_USER);
  const data = await seedRealistic(user);
  await login(page, user);

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ana');
  await expect(page.getByRole('heading', { name: 'Próximos atendimentos' })).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.goto(`/agenda?data=${data.nextDay}`);
  await expect(page.getByText(LONG_NAME).first()).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.goto(`/agenda?visao=dia&data=${data.nextDay}`);
  await expect(page.getByText(LONG_NAME).first()).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.goto('/historico');
  await expect(page.getByRole('heading', { name: 'Histórico e busca' })).toBeVisible();
  await expect(page.getByText(LONG_NAME).first()).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.goto('/ajustes');
  await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test('títulos usam a fonte da marca (Manrope), sem cair na fonte padrão', async ({
  page,
  makeUser,
}) => {
  const user = await makeUser(REALISTIC_USER);
  const data = await seedRealistic(user);
  await login(page, user);
  const pages: Array<[string, string]> = [
    ['/', 'Próximos atendimentos'],
    ['/agenda', 'Agenda'],
    ['/historico', 'Histórico e busca'],
    ['/ajustes/expediente', 'Ajustes'],
    [`/agenda/remarcar/${data.ids.agendado}`, 'Remarcar atendimento'],
    ['/pagina-que-nao-existe', 'Página não encontrada'],
  ];
  for (const [path, heading] of pages) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    const families = await page
      .locator('h1, h2, h3')
      .evaluateAll((els) => els.map((e) => [e.textContent, getComputedStyle(e).fontFamily]));
    for (const [text, family] of families) {
      expect(family, `título "${text}" em ${path}`).toMatch(/^"?Manrope Variable"?/);
    }
  }
});

test('remarcar: a barra de confirmação não fica sob a navegação', async ({ page, makeUser }) => {
  const user = await makeUser(REALISTIC_USER);
  const data = await seedRealistic(user);
  await login(page, user);
  await page.goto(`/agenda/remarcar/${data.ids.agendado}`);
  const bar = page.getByTestId('reschedule-bar');
  await expect(bar.getByRole('button', { name: 'Confirmar remarcação' })).toBeVisible();
  const nav = page.getByTestId(isDesktop(page) ? 'side-rail' : 'bottom-nav');
  const barBox = (await bar.boundingBox())!;
  const navBox = (await nav.boundingBox())!;
  expect(overlaps(barBox, navBox)).toBe(false);
});

test('Início no computador: a tabela de próximos não fica sob o calendário (1440 e 1024 px)', async ({
  page,
  makeUser,
}) => {
  test.skip(!isDesktop(page), 'tabela e calendário só existem no computador');
  const user = await makeUser(REALISTIC_USER);
  await seedRealistic(user);
  await login(page, user);
  for (const size of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(size);
    await page.goto('/');
    const table = page.locator('section[aria-labelledby="proximos"] table');
    const calendar = page.getByRole('region', { name: 'Calendário do mês' });
    await expect(table).toBeVisible();
    await expect(calendar).toBeVisible();
    const t = (await table.boundingBox())!;
    const c = (await calendar.boundingBox())!;
    expect(overlaps(t, c), `tabela sob o calendário em ${size.width} px`).toBe(false);
    // Cada "Remarcar" da tabela pode ser clicado (nada por cima).
    const links = page.getByRole('link', { name: /^Remarcar / });
    for (let i = 0; i < (await links.count()); i++) {
      await links.nth(i).click({ trial: true });
    }
    await expectNoHorizontalScroll(page);
  }
});

test('Ajustes › Expediente: área de toque dos interruptores ≥ 44 px, sem invadir horários', async ({
  page,
  makeUser,
}) => {
  const user = await makeUser();
  await login(page, user);
  await page.goto('/ajustes/expediente');
  await expect(page.getByRole('switch', { name: 'Atender em Segunda' })).toBeVisible();
  for (const day of DAYS) await checkDaySwitch(page, day);
});

test('Primeiro acesso: área de toque dos interruptores ≥ 44 px, sem invadir horários', async ({
  page,
  makeUser,
}) => {
  const user = await makeUser({ hours: false });
  await login(page, user);
  await expect(page).toHaveURL(/\/primeiro-acesso$/);
  for (const day of DAYS) {
    await page.getByRole('button', { name: new RegExp(`^${day.short} `) }).click();
    await checkDaySwitch(page, day);
  }
  await expectNoHorizontalScroll(page);
});

test('Detalhes em 390 px: rótulos das ações inteiros, sem rolagem lateral', async ({
  page,
  makeUser,
}) => {
  if (!isDesktop(page)) await page.setViewportSize({ width: 390, height: 844 });
  const user = await makeUser(REALISTIC_USER);
  const data = await seedRealistic(user);
  await login(page, user);

  const cases: Array<[string, string]> = [
    [data.ids.agendado, 'Remarcar'],
    [data.ids.longo, 'Remarcar'],
    [data.ids.concluido, 'Marcar como não compareceu'],
    [data.ids.naoCompareceu, 'Marcar como concluído'],
    [data.ids.cancelado, 'Reativar'],
  ];
  for (const [id, action] of cases) {
    await page.goto(`/?atendimento=${id}`);
    const sheet = detailsSheet(page);
    await expect(sheet.getByRole('button', { name: action })).toBeVisible();
    await expectSheetFits(sheet);
  }
});

async function expectSheetFits(sheet: Locator) {
  const result = await sheet.evaluate((el) => {
    const clipped = [...el.querySelectorAll('button, a')]
      .filter((b) => b.scrollWidth > b.clientWidth)
      .map((b) => b.textContent?.trim());
    const scrollers = [el, ...el.querySelectorAll('*')].filter((e) => {
      const s = getComputedStyle(e);
      return (s.overflowX === 'auto' || s.overflowX === 'scroll') && e.scrollWidth > e.clientWidth;
    });
    return { clipped, horizontal: scrollers.length, root: [el.scrollWidth, el.clientWidth] };
  });
  expect(result.clipped, 'botões com rótulo cortado').toEqual([]);
  expect(result.horizontal, 'áreas com rolagem horizontal no painel').toBe(0);
  expect(result.root[0]).toBeLessThanOrEqual(result.root[1]!);
}

test('/instalar sem login: sem rolagem lateral em 390 px e alvos de toque ≥ 44 px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/instalar');
  await expect(page.getByRole('heading', { name: 'Instalar o app' })).toBeVisible();
  for (const name of ['iPhone', 'Android', 'Computador']) {
    await page.getByRole('tab', { name }).click();
    await expectNoHorizontalScroll(page);
    const box = (await page.getByRole('tab', { name }).boundingBox())!;
    expect(box.height, `aba ${name}`).toBeGreaterThanOrEqual(44);
  }
  const back = (await page.getByRole('link', { name: /Voltar/ }).boundingBox())!;
  expect(back.height).toBeGreaterThanOrEqual(44);
});
