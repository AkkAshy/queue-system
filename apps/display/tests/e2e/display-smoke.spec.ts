import { test, expect } from '@playwright/test';

test('board shows seeded active calls with a window label', async ({ page }) => {
  await page.goto('/');

  // The "now serving" panel shows a seeded call (a ticket number like G004).
  await expect(page.locator('text=/^[A-Z]\\d{3}$/').first()).toBeVisible({
    timeout: 20_000,
  });

  // …routed to a window (the bottom strip labels every window "N-oyna").
  await expect(page.locator('text=/\\d+-oyna/').first()).toBeVisible({
    timeout: 10_000,
  });

  // The "now serving" panel header is present (board is Uzbek).
  await expect(
    page.locator("text=/Hozir xizmat ko'rsatilmoqda/").first(),
  ).toBeVisible();
});
