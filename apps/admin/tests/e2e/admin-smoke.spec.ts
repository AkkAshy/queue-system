import { test, expect } from '@playwright/test';

test('admin happy path: login → each page loads', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'Вход в панель' })).toBeVisible({
    timeout: 20_000,
  });

  await page.getByLabel('Логин').fill('admin');
  await page.getByLabel('Пароль').fill('admin');
  await page.getByRole('button', { name: 'Войти' }).click();

  // dashboard
  await expect(
    page.getByRole('heading', { name: /Сегодня в офисе/ }),
  ).toBeVisible({ timeout: 20_000 });

  for (const [href, heading] of [
    ['/services', /Услуги/],
    ['/categories', /Категории/],
    ['/counters', /Окна/],
    ['/operators', /Операторы/],
  ] as const) {
    await page.getByRole('link', { name: heading }).first().click();
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible({
      timeout: 10_000,
    });
    expect(page.url()).toContain(href);
  }

  // logout
  await page.getByRole('button', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
});
