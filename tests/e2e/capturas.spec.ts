import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import {
  detailsSheet,
  expect,
  isDesktop,
  login,
  mainNav,
  test,
  type TestUser,
  type UserOptions,
} from './support/fixtures.ts';
import { LONG_NAME, REALISTIC_USER, seedRealistic } from './support/seed.ts';

/**
 * Capturas de tela para revisão visual (não são testes de regressão). Só rodam com
 * `E2E_CAPTURAS=1` e gravam em `.superpowers/sdd/2026-11-06-identidade-visual/screens/<projeto>/<tema>/`
 * (fora do controle de versão).
 */
const ENABLED = !!process.env.E2E_CAPTURAS;
const OUT = fileURLToPath(
  new URL('../../.superpowers/sdd/2026-11-06-identidade-visual/screens/', import.meta.url),
);

test.skip(!ENABLED, 'capturas só com E2E_CAPTURAS=1');

for (const theme of ['claro', 'escuro'] as const) {
  test(`capturas das telas com dados realistas (${theme})`, async ({
    page,
    makeUser,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === 'chromium-android',
      'capturas só no iPhone e no computador',
    );
    test.setTimeout(180_000);
    await page.emulateMedia({ colorScheme: theme === 'escuro' ? 'dark' : 'light' });
    await capturar(page, makeUser, testInfo.project.name, theme);
  });
}

async function capturar(
  page: Page,
  makeUser: (opts?: UserOptions) => Promise<TestUser>,
  project: string,
  theme: string,
) {
  // Página inteira para telas que rolam; só a janela para gavetas/diálogos e barras fixas
  // (na captura de página inteira o WebKit reposiciona elementos fixos no meio da imagem).
  const shot = (name: string, fullPage = true) =>
    page.screenshot({
      path: `${OUT}${project}/${theme}/${name}.png`,
      fullPage,
      animations: 'disabled',
    });

  const user = await makeUser(REALISTIC_USER);
  const data = await seedRealistic(user);

  await page.goto('/entrar');
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await shot('01-entrar');

  await login(page, user);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Próximos atendimentos' })).toBeVisible();
  await shot('02-inicio');

  await page.goto(`/agenda?visao=dia&data=${data.day}`);
  await expect(page.getByText(/^\d+ atendimentos?$/)).toBeVisible();
  await shot('03-agenda-dia');
  await page.goto(`/agenda?visao=dia&data=${data.nextDay}`);
  await expect(page.getByText(LONG_NAME).first()).toBeVisible();
  await shot('03b-agenda-dia-seguinte');

  if (isDesktop(page)) {
    await page.goto(`/agenda?visao=semana&data=${data.day}`);
    await expect(page.getByText('Patrícia Gomes').first()).toBeVisible();
    await shot('04-agenda-semana');
    await page.goto(`/agenda?visao=mes&data=${data.day}`);
    await expect(
      page
        .getByRole('group', { name: 'Modo de visualização' })
        .getByRole('button', { name: 'Mês', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Camila Torres').first()).toBeVisible();
    await shot('05-agenda-mes');
  } else {
    await page.goto(`/agenda?visao=lista&data=${data.day}`);
    await expect(page.getByText('Camila Torres').first()).toBeVisible();
    await shot('04-agenda-lista');
  }

  await newWithConflict(page, data.nextDay);
  await shot('06-novo-agendamento-conflito', false);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Novo agendamento' })).toBeHidden();

  await page.goto(`/?atendimento=${data.ids.agendado}`);
  await expect(detailsSheet(page).getByRole('button', { name: 'Remarcar' })).toBeVisible();
  await expect(detailsSheet(page).getByText('Agendamento criado')).toBeVisible();
  await shot('07-detalhes', false);
  await page.goto(`/?atendimento=${data.ids.cancelado}`);
  await expect(detailsSheet(page).getByText('Motivo: Cliente teve um imprevisto')).toBeVisible();
  await shot('07b-detalhes-cancelado', false);
  await page.goto(`/?atendimento=${data.ids.longo}`);
  await expect(detailsSheet(page).getByText('Agendamento criado')).toBeVisible();
  await shot('07c-detalhes-nome-longo', false);

  await page.goto(`/agenda/remarcar/${data.ids.agendado}`);
  await expect(page.getByRole('heading', { name: 'Remarcar atendimento' })).toBeVisible();
  await page
    .getByRole('button', { name: /^(Seg|Ter|Qua|Qui|Sex) / })
    .last()
    .click();
  await page.getByRole('button', { name: '10:00', exact: true }).click();
  await expect(page.getByText(/ às 10:00$/)).toBeVisible();
  await shot('08-remarcar', false);

  await page.goto('/historico');
  await expect(page.getByText(LONG_NAME).first()).toBeVisible();
  await shot('09-historico');

  await page.goto('/ajustes/perfil');
  await expect(page.getByLabel('Seu nome')).toHaveValue('Ana Paula Ribeiro');
  await shot('10-ajustes-perfil');
  await page.goto('/ajustes/expediente');
  await expect(page.getByRole('switch', { name: 'Atender em Segunda' })).toBeVisible();
  await shot('11-ajustes-expediente');
  await page.goto('/ajustes/notificacoes');
  await expect(page.getByRole('heading', { name: 'Notificações' })).toBeVisible();
  await shot('12-ajustes-notificacoes');
  if (!isDesktop(page)) {
    await page.goto('/ajustes');
    await expect(page.getByRole('link', { name: 'Conta e privacidade' })).toBeVisible();
    await shot('12b-ajustes-menu');
  }

  await page.goto('/pagina-que-nao-existe');
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible();
  await shot('13-404');

  // Primeiro acesso: outra conta, ainda sem expediente.
  const fresh = await makeUser({ name: 'Bruna Lopes', hours: false });
  await page.evaluate(() => localStorage.clear());
  await login(page, fresh);
  await expect(page.getByRole('heading', { name: 'Quando você atende?' })).toBeVisible();
  await shot('14-primeiro-acesso');
  await page.getByRole('button', { name: /^Seg / }).click();
  await expect(page.getByRole('switch', { name: 'Atender em Segunda' })).toBeVisible();
  await shot('14b-primeiro-acesso-dia-aberto');
}

async function newWithConflict(page: Page, day: string) {
  await mainNav(page).getByRole('button', { name: 'Novo agendamento' }).click();
  const form = page.getByRole('dialog', { name: 'Novo agendamento' });
  await form.getByLabel('Nome do cliente').fill('Sofia Martins');
  await form.getByRole('button', { name: /^Corte feminino/ }).click();
  await form.getByLabel('Data', { exact: true }).fill(day);
  await form.getByLabel('Início', { exact: true }).fill('14:30');
  await expect(form.getByText('conflita com')).toBeVisible();
  const free = form.getByRole('region', { name: /^Livres em / });
  await expect(free.getByRole('button').first()).toBeVisible();
  // No celular o painel fica abaixo da dobra da gaveta.
  await form.getByText('conflita com').scrollIntoViewIfNeeded();
}
