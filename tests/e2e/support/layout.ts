import { expect, type Page } from '@playwright/test';

/** Nem o `body` nem a página rolam na horizontal. */
export async function expectNoHorizontalScroll(page: Page) {
  const sizes = await page.evaluate(() => ({
    body: [document.body.scrollWidth, document.body.clientWidth],
    root: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
  }));
  expect(sizes.body[0], `body rola na horizontal em ${page.url()}`).toBeLessThanOrEqual(
    sizes.body[1]!,
  );
  expect(sizes.root[0], `página rola na horizontal em ${page.url()}`).toBeLessThanOrEqual(
    sizes.root[1]!,
  );
}
