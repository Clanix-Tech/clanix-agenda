import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import {
  deleteUserByEmail,
  expect,
  login,
  mainNav,
  test,
  uniqueEmail,
} from './support/fixtures.ts';
import { waitForAuthLink } from './support/mailpit.ts';

const EMPTY = 'Sua agenda está livre. Que tal marcar o primeiro atendimento?';

async function signOut(page: Page) {
  await mainNav(page).getByRole('link', { name: 'Ajustes' }).click();
  await page.getByRole('link', { name: 'Conta e privacidade' }).click();
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
}

test('criar conta → primeiro acesso → Início vazio; sair e entrar de novo', async ({
  page,
}, testInfo) => {
  const email = uniqueEmail(`cadastro-${testInfo.project.name}`);
  const password = `Senha-${randomUUID()}`;
  try {
    await page.goto('/cadastro');
    await page.getByLabel('Nome', { exact: true }).fill('Bruna Cadastro');
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Senha', { exact: true }).fill(password);
    await page.getByLabel('Confirmar senha').fill(password);
    await page.getByRole('button', { name: 'Criar conta' }).click();

    await expect(page).toHaveURL(/\/primeiro-acesso$/);
    await expect(page.getByRole('heading', { name: 'Quando você atende?' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /^Seg 09:00–12:00 · 13:00–18:00/ }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar e começar' }).click();

    await expect(page).toHaveURL(/:\d+\/$/);
    await expect(page.getByText(EMPTY)).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Bruna');

    await signOut(page);

    // R20: depois de "Sair", entrar de novo leva ao Início (não volta para Ajustes).
    await login(page, { email, password });
    await expect(page).toHaveURL(/:\d+\/$/);
    await expect(page.getByText(EMPTY)).toBeVisible();
  } finally {
    await deleteUserByEmail(email);
  }
});

test('recuperar senha pelo e-mail (Mailpit) e entrar com a nova senha', async ({
  page,
  makeUser,
}) => {
  const user = await makeUser();
  const newPassword = `Nova-${randomUUID()}`;

  await page.goto('/entrar');
  await page.getByRole('link', { name: 'Esqueci minha senha' }).click();
  await expect(page).toHaveURL(/\/recuperar-senha$/);
  // A URL muda antes de a nova tela aparecer (navegação em transição): espera o título.
  await expect(page.getByRole('heading', { name: 'Recuperar senha' })).toBeVisible();
  await page.getByLabel('E-mail').fill(user.email);
  await page.getByRole('button', { name: 'Enviar link' }).click();
  await expect(
    page.getByText('Se houver uma conta com esse e-mail, você vai receber um link.'),
  ).toBeVisible();

  const link = await waitForAuthLink(user.email);
  await page.goto(link);

  await expect(page).toHaveURL(/\/redefinir-senha/);
  await expect(page.getByRole('heading', { name: 'Redefinir senha' })).toBeVisible();
  await page.getByLabel('Nova senha', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirmar senha').fill(newPassword);
  await page.getByRole('button', { name: 'Salvar nova senha' }).click();
  await expect(page.getByText('Senha alterada')).toBeVisible();
  await expect(page).toHaveURL(/:\d+\/$/);

  await signOut(page);

  // A senha antiga deixou de valer.
  await page.getByLabel('E-mail').fill(user.email);
  await page.getByLabel('Senha', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/entrar$/);

  await login(page, { email: user.email, password: newPassword });
  await expect(page).toHaveURL(/:\d+\/$/);
  await expect(mainNav(page)).toBeVisible();
});
