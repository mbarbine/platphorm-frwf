import { expect, test } from '@playwright/test';

test('Chaos AI leaves the ring, physically grips a prop, and lands a prop impact', async ({ page }) => {
  const errors: string[] = []; page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); }); page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: /CHAOS CIRCUIT/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();
  const hud = page.locator('.hud'); const telemetry = page.locator('[data-prop-bodies]');
  await expect(hud).toHaveAttribute('data-physics-bodies', '32', { timeout: 30_000 });
  await expect(telemetry).toHaveAttribute('data-prop-bodies', '3');
  await expect.poll(async () => await telemetry.getAttribute('data-opponent-held-prop'), { timeout: 70_000, intervals: [250, 500, 750] }).toMatch(/chair|sign|trash/);
  await expect.poll(async () => Number(await telemetry.getAttribute('data-prop-grips')), { timeout: 15_000 }).toBeGreaterThan(0);
  await expect.poll(async () => Number(await telemetry.getAttribute('data-total-prop-impacts')), { timeout: 70_000, intervals: [350, 700, 1_000] }).toBeGreaterThan(0);
  await expect(telemetry).toHaveAttribute('data-table-stage', /intact|stressed|cracked|failed/);
  expect(errors).toEqual([]);
});
