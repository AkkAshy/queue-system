import { test, expect } from '@playwright/test';

// UI defaults to Uzbek (staff apps are uz ⇄ kaa, uz is the default).
test('admin happy path: login → each page loads', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'Panelga kirish' })).toBeVisible({
    timeout: 20_000,
  });

  await page.getByLabel('Login').fill('admin');
  await page.getByLabel('Parol').fill('admin');
  await page.getByRole('button', { name: 'Kirish' }).click();

  // dashboard
  await expect(
    page.getByRole('heading', { name: /Bugun registrator ofisida/ }),
  ).toBeVisible({ timeout: 20_000 });

  for (const [href, heading] of [
    ['/services', /Xizmatlar/],
    ['/categories', /Kategoriyalar/],
    ['/counters', /Oynalar/],
    ['/operators', /Operatorlar/],
  ] as const) {
    await page.getByRole('link', { name: heading }).first().click();
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible({
      timeout: 10_000,
    });
    expect(page.url()).toContain(href);
  }

  // logout
  await page.getByRole('button', { name: 'Chiqish' }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
});
