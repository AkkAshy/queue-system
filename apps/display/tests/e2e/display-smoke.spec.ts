import { test, expect } from '@playwright/test';

test('board shows seeded active calls with a window label', async ({ page }) => {
  await page.goto('/');

  // The hero shows the freshest seeded call (a ticket number like A013 / G004).
  await expect(page.locator('text=/^[A-Z]\\d{3}$/').first()).toBeVisible({
    timeout: 20_000,
  });

  // …routed to a window.
  await expect(page.locator('text=/Okno\\s+№\\d+/').first()).toBeVisible({
    timeout: 10_000,
  });

  // The "previous calls" section header is present.
  await expect(
    page.locator('text=/Предыдущие вызовы/').first(),
  ).toBeVisible();
});
