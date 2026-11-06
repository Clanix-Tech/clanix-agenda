import { expect, isDesktop, login, mainNav, test } from './support/fixtures.ts';

// Gaveta (vaul) do celular. Bug relatado no APK: arrastar o formulário para baixo para conferir o
// nome digitado fechava a gaveta e descartava o que foi digitado.
test.describe('gaveta do formulário no celular', () => {
  test.beforeEach(({ page }) => {
    test.skip(isDesktop(page), 'no computador o formulário é uma janela, sem gaveta');
  });

  test('arrastar o conteúdo para baixo não fecha o formulário nem perde o que foi digitado', async ({
    page,
    makeUser,
  }) => {
    const user = await makeUser();
    await login(page, user);
    await mainNav(page).getByRole('button', { name: 'Novo agendamento' }).click();
    const form = page.getByRole('dialog', { name: 'Novo agendamento' });
    const name = form.getByLabel('Nome do cliente');
    await name.fill('Joana Prado');
    await name.blur();
    // Espera a animação de abertura (a vaul ignora arrastos nos primeiros 500 ms).
    await page.waitForTimeout(700);

    // Arrasta o dedo para baixo começando no campo do nome (conteúdo já no topo).
    const box = (await name.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(x, y + i * 40);
    await page.mouse.up();
    await page.waitForTimeout(700);

    await expect(form).toBeVisible();
    await expect(name).toHaveValue('Joana Prado');
  });

  test('com o teclado aberto, o campo do nome continua visível dentro da gaveta', async ({
    page,
    makeUser,
  }) => {
    // O Android só encolhe a página com o teclado por causa de `interactive-widget=resizes-content`
    // (sem ele o teclado cobre a gaveta presa ao fundo). O Playwright não abre teclado virtual:
    // conferimos a meta e simulamos a página encolhida.
    const user = await makeUser();
    await login(page, user);
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
      'content',
      /interactive-widget=resizes-content/,
    );
    await mainNav(page).getByRole('button', { name: 'Novo agendamento' }).click();
    const form = page.getByRole('dialog', { name: 'Novo agendamento' });
    const name = form.getByLabel('Nome do cliente');
    await name.focus();
    await name.fill('Joana Prado');

    const { width } = page.viewportSize()!;
    await page.setViewportSize({ width, height: 360 }); // teclado ocupando boa parte da tela
    await page.waitForTimeout(500);

    const field = (await name.boundingBox())!;
    expect(field.y).toBeGreaterThanOrEqual(0);
    expect(field.y + field.height).toBeLessThanOrEqual(360);
    const drawer = (await form.boundingBox())!;
    expect(drawer.y).toBeGreaterThanOrEqual(0);
    expect(drawer.y + drawer.height).toBeLessThanOrEqual(360 + 1);
  });

  test('arrastar pela alça para baixo ainda fecha a gaveta', async ({ page, makeUser }) => {
    const user = await makeUser();
    await login(page, user);
    await mainNav(page).getByRole('button', { name: 'Novo agendamento' }).click();
    const form = page.getByRole('dialog', { name: 'Novo agendamento' });
    await expect(form).toBeVisible();
    await page.waitForTimeout(700);

    const box = (await form.locator('[data-vaul-handle]').boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(x, y + i * 60);
    await page.mouse.up();

    await expect(form).toBeHidden();
  });
});
