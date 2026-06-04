import { test, expect } from '@playwright/test';

// UI defaults to Uzbek (operator app is uz ⇄ kaa, uz is the default).
test('operator flow: login → call next → finish', async ({ page }) => {
  await page.goto('/');

  // Login screen
  await expect(page.getByRole('heading', { name: 'Kirish' })).toBeVisible({
    timeout: 20_000,
  });

  // Pick operator (first "operator" in the seed → role=operator)
  await page.getByText('Tanlash…').first().click();
  await page.getByRole('option', { name: /operator/i }).first().click();

  // Pick counter
  await page.getByText('Tanlash…').first().click();
  await page.getByRole('option', { name: /№1/ }).click();

  await page.getByRole('button', { name: 'Smenani boshlash' }).click();

  // Widget loaded — we see the "№1" header
  await expect(page.locator('text=/№\\s*1/').first()).toBeVisible({
    timeout: 10_000,
  });

  // The Call-Next button shows a ticket number when queue has items
  const callBtn = page.getByRole('button', { name: /CHAQIRISH\s+[A-Z]\d+/ });
  await expect(callBtn).toBeEnabled({ timeout: 10_000 });
  await callBtn.click();

  // After call, the "now serving" header is visible
  await expect(page.locator("text=Hozir xizmat ko'rsatyapsiz")).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tugatish' })).toBeEnabled({
    timeout: 5_000,
  });

  // Finish
  await page.getByRole('button', { name: 'Tugatish' }).click();

  // Back to "no active ticket"
  await expect(page.locator("text=Faol talon yo'q")).toBeVisible({
    timeout: 5_000,
  });
});
