import { expect, test } from '@playwright/test';

test.use({ hasTouch: true, viewport: { width: 844, height: 390 }, video: 'on', trace: 'off' });

test('touch Get Up returns an exhausted, downed wrestler to supported player control', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?physicsLab=1');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();
  const hud = page.locator('.hud');
  await expect(page.getByTestId('game-canvas')).toHaveAttribute('data-simulation-ready', 'true', { timeout: 45000 });
  const tutorial = page.getByRole('button', { name: 'Close tutorial' });
  if (await tutorial.isVisible()) await tutorial.click();
  // The visible lab sets up the fall only. It sends no recovery input and
  // leaves a 15-second down timer; the ordinary touch button must end it.
  await page.getByRole('button', { name: 'DOWNED — MANUAL GET-UP' }).click();
  await expect(hud).toHaveAttribute('data-player-state', 'downed');
  const getUp = page.getByTestId('mobile-controls').getByRole('button', { name: 'Get up', exact: true });
  await getUp.tap();
  await expect(hud.locator('[data-last-action]')).toHaveAttribute('data-last-action', 'dodgeCounter');
  await expect(hud.locator('[data-last-action]')).toHaveAttribute('data-last-action-source', 'touch');
  await expect(hud.locator('[data-last-action]')).toHaveAttribute('data-last-action-status', 'executed');
  await expect(hud).toHaveAttribute('data-player-state', 'idle', { timeout: 12000 });
  expect(Number(await hud.getAttribute('data-player-upright'))).toBeGreaterThan(.9);
  expect(Number(await hud.getAttribute('data-player-support-feet'))).toBeGreaterThan(0);
  await expect(page.getByTestId('mobile-controls').getByRole('button', { name: 'Dodge or counter' })).toBeVisible();
  await page.screenshot({ path: 'test-results/touch-get-up-standing.png' });
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0');
  expect(errors).toEqual([]);
});
