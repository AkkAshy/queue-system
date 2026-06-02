import { test, expect } from '@playwright/test';

test('operator flow: login → call next → finish', async ({ page }) => {
  await page.goto('/');

  // Login screen
  await expect(page.getByRole('heading', { name: 'Начало смены' })).toBeVisible({
    timeout: 20_000,
  });

  // Pick operator (first "operator" in the seed is operator1 · Aygül Nurmanova → role=operator)
  await page.getByText('Выбрать…').first().click();
  await page.getByRole('option', { name: /operator/i }).first().click();

  // Pick counter
  await page.getByText('Выбрать…').first().click();
  await page.getByRole('option', { name: /№1/ }).click();

  await page.getByRole('button', { name: 'Начать смену' }).click();

  // Widget loaded — we see the "№1" header
  await expect(page.locator('text=/№\\s*1/').first()).toBeVisible({
    timeout: 10_000,
  });

  // The Call-Next button shows a ticket number when queue has items
  const callBtn = page.getByRole('button', { name: /ВЫЗВАТЬ\s+[A-Z]\d+/ });
  await expect(callBtn).toBeEnabled({ timeout: 10_000 });
  await callBtn.click();

  // After call, "Сейчас обслуживаете" has a number
  await expect(page.locator('text=Сейчас обслуживаете')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Завершить' })).toBeEnabled({
    timeout: 5_000,
  });

  // Finish
  await page.getByRole('button', { name: 'Завершить' }).click();

  // Back to "Нет активного талона"
  await expect(page.locator('text=Нет активного талона')).toBeVisible({
    timeout: 5_000,
  });
});
