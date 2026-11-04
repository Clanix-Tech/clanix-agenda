import { expect, login, mainNav, test } from './support/fixtures.ts';

// Projeto `pwa`: o service worker só existe no build, servido por `vite preview`.

test('manifesto tem os campos de um app instalável', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBe(true);
  const m = await res.json();
  expect(m).toMatchObject({
    name: 'Agenda em Ordem',
    short_name: 'Agenda',
    lang: 'pt-BR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: '#0F2D5B',
    background_color: '#F8FAFC',
  });
  const icons = m.icons as Array<{ sizes: string; purpose?: string }>;
  for (const sizes of ['64x64', '192x192', '512x512']) {
    expect(icons.some((i) => i.sizes === sizes && !i.purpose)).toBe(true);
  }
  expect(icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable')).toBe(true);
});

test('service worker ativa e não guarda respostas do Supabase no cache', async ({
  page,
  makeUser,
}) => {
  const user = await makeUser();
  await login(page, user);
  await page.goto('/agenda');
  await expect(mainNav(page)).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));

  const supabaseUrl = process.env.E2E_SUPABASE_URL as string;
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const req of await cache.keys()) urls.push(`${name} ${req.url}`);
    }
    return urls;
  });
  expect(cached.length).toBeGreaterThan(0);
  expect(cached.filter((u) => u.includes(new URL(supabaseUrl).host))).toEqual([]);
});

test('sem internet, recarregar "/" ainda abre a casca do app com o aviso de sem conexão', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  // A primeira carga não é controlada pelo service worker; recarregar passa a ser.
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  // Sem sessão o app leva a "/entrar": tela e código vêm do cache do service worker.
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
  await expect(page.getByText('Sem conexão.')).toBeVisible();
});
