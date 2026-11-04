import type { Locator, Page } from '@playwright/test';
import { countAppointments, expect, login, mainNav, test } from './support/fixtures.ts';
import { nextBusinessDays } from './support/dates.ts';

const OFFLINE_MSG = 'Sem conexão. Nada foi salvo — tente novamente.';

async function fillNewAppointment(page: Page, day: string): Promise<Locator> {
  await mainNav(page).getByRole('button', { name: 'Novo agendamento' }).click();
  const form = page.getByRole('dialog', { name: 'Novo agendamento' });
  await form.getByLabel('Nome do cliente').fill('Lia Moraes');
  await form.getByLabel('Telefone').fill('(11) 97777-6666');
  await form.getByLabel('Nome do serviço').fill('Hidratação');
  await form.getByLabel('Data', { exact: true }).fill(day);
  await form.getByLabel('Início', { exact: true }).fill('10:00');
  await form.getByLabel('Observações').fill('Trazer toalha');
  await expect(form.getByText('Horário livre, dentro do expediente')).toBeVisible();
  return form;
}

async function expectFieldsKept(form: Locator, day: string) {
  await expect(form.getByLabel('Nome do cliente')).toHaveValue('Lia Moraes');
  await expect(form.getByLabel('Telefone')).toHaveValue('(11) 97777-6666');
  await expect(form.getByLabel('Nome do serviço')).toHaveValue('Hidratação');
  await expect(form.getByLabel('Data', { exact: true })).toHaveValue(day);
  await expect(form.getByLabel('Início', { exact: true })).toHaveValue('10:00');
  await expect(form.getByLabel('Observações')).toHaveValue('Trazer toalha');
}

test('sem internet ao salvar: nada é salvo, campos ficam e "Tentar novamente" grava uma vez', async ({
  page,
  context,
  makeUser,
}) => {
  const user = await makeUser();
  const [day] = nextBusinessDays(1) as [string];
  await login(page, user);
  const form = await fillNewAppointment(page, day);

  await context.setOffline(true);
  await form.getByRole('button', { name: 'Salvar agendamento' }).click();
  await expect(form.getByRole('alert')).toContainText(OFFLINE_MSG);
  await expect(page.getByText('Agendamento salvo')).toHaveCount(0);
  await expectFieldsKept(form, day);
  expect(await countAppointments(user.id)).toBe(0);

  await context.setOffline(false);
  await form.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByText('Agendamento salvo')).toBeVisible();
  await expect(form).toBeHidden();
  expect(await countAppointments(user.id)).toBe(1);
});

test('conexão cai depois de o banco gravar: o retry reconhece o próprio agendamento (RN17)', async ({
  page,
  makeUser,
}) => {
  const user = await makeUser();
  const [day] = nextBusinessDays(1) as [string];
  await login(page, user);
  const form = await fillNewAppointment(page, day);

  // 1ª chamada chega ao banco, mas a resposta se perde no caminho.
  let calls = 0;
  await page.route('**/rest/v1/rpc/create_appointment', async (route) => {
    calls += 1;
    if (calls === 1) {
      await route.fetch();
      await route.abort('internetdisconnected');
    } else {
      await route.continue();
    }
  });

  await form.getByRole('button', { name: 'Salvar agendamento' }).click();
  await expect(form.getByRole('alert')).toContainText(OFFLINE_MSG);
  await expectFieldsKept(form, day);
  expect(await countAppointments(user.id)).toBe(1);

  await form.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByText('Agendamento salvo')).toBeVisible();
  await expect(form).toBeHidden();
  await expect(page.getByText('Esse horário já está ocupado')).toHaveCount(0);
  expect(calls).toBe(2);
  expect(await countAppointments(user.id)).toBe(1);
});
