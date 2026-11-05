import {
  countAppointments,
  expect,
  login,
  mainNav,
  seedAppointment,
  test,
} from './support/fixtures.ts';

test('excluir a conta pela tela apaga os dados e impede de entrar de novo', async ({
  page,
  makeUser,
}) => {
  const user = await makeUser();
  await seedAppointment(user, {
    date: '2030-01-07',
    start: '10:00',
    end: '11:00',
    name: 'Cliente Exclusão',
  });
  expect(await countAppointments(user.id)).toBe(1);

  await login(page, user);
  await mainNav(page).getByRole('link', { name: 'Ajustes' }).click();
  await page.getByRole('link', { name: 'Conta e privacidade' }).click();
  await page.getByRole('button', { name: 'Excluir minha conta' }).click();

  const dialog = page.getByRole('dialog', { name: 'Excluir minha conta' });
  await dialog.getByLabel('Senha atual').fill(user.password);
  await dialog.getByRole('button', { name: 'Excluir para sempre' }).click();

  await expect(page).toHaveURL(/\/entrar\?conta=excluida$/);
  await expect(page.getByText('Sua conta e todos os seus dados foram excluídos.')).toBeVisible();
  expect(await countAppointments(user.id)).toBe(0);

  await page.getByLabel('E-mail').fill(user.email);
  await page.getByLabel('Senha', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible();
});
