import { expect, login, mainNav, test } from './support/fixtures.ts';

test('tema escuro do sistema vale antes do React: classe dark e theme-color', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  // Sem o bundle do app (React nunca roda): quem aplica o tema é só o tema.js, antes da primeira pintura.
  await page.route('**/assets/*.js', (route) => route.abort());
  await page.goto('/entrar', { waitUntil: 'domcontentloaded' });
  const state = await page.evaluate(() => ({
    dark: document.documentElement.classList.contains('dark'),
    meta: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
  }));
  expect(state.dark).toBe(true);
  expect(state.meta).toBe('#0B0420');
});

test('escolher Claro com o sistema escuro vale após recarregar; gaveta escura usa #1D0E4A', async ({
  page,
  makeUser,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  const user = await makeUser();
  await login(page, user);
  const html = page.locator('html');
  await expect(html).toHaveClass(/dark/);

  // Gaveta/janela de novo agendamento no escuro.
  await mainNav(page).getByRole('button', { name: 'Novo agendamento' }).click();
  const form = page.getByRole('dialog', { name: 'Novo agendamento' });
  await expect(form).toBeVisible();
  await expect(form).toHaveCSS('background-color', 'rgb(29, 14, 74)');
  await page.keyboard.press('Escape');
  await expect(form).toBeHidden();

  await page.goto('/ajustes/aparencia');
  await page.getByText('Claro', { exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Claro' })).toBeChecked();
  await expect(html).not.toHaveClass(/dark/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#F8F7FF');

  await page.reload({ waitUntil: 'domcontentloaded' });
  const afterReload = await page.evaluate(() => ({
    dark: document.documentElement.classList.contains('dark'),
    meta: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
  }));
  expect(afterReload.dark).toBe(false);
  expect(afterReload.meta).toBe('#F8F7FF');
});
