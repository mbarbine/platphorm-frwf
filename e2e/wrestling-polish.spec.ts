import { expect, test } from '@playwright/test';

test.use({ video: 'on' });

test('chooses and releases a physical throw through ordinary wrestling controls', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: /^EASY/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();
  const hud = page.locator('.hud');
  await expect(page.getByTestId('game-canvas')).toHaveAttribute('data-simulation-ready', 'true', { timeout: 45000 });
  await expect(page.locator('html')).toHaveAttribute('data-game-input-ready', 'true');
  const tutorial = page.getByRole('button', { name: 'Close tutorial' });
  if (await tutorial.isVisible()) await tutorial.click();
  await page.keyboard.press('l');
  await expect(page.getByTestId('control-deck').getByText('CIRCUIT TRIP', { exact: true })).toBeVisible();
  await page.keyboard.press('k');
  await expect(page.getByTestId('control-deck').getByText('RELEASE THROW', { exact: true })).toBeVisible({ timeout: 12000 });
  await page.keyboard.press('j');
  await expect(hud.locator('[data-last-action]')).toHaveAttribute('data-last-action', 'quickStrike');
  await expect(hud.locator('[data-last-action]')).toHaveAttribute('data-last-action-status', 'executed');
  await expect(page.getByTestId('control-deck').getByText(/^(PIN SHOULDERS|APPROACH & PIN)$/)).toBeVisible({ timeout: 12000 });
  await page.screenshot({ path: 'test-results/polish-throw-landing.png' });
  await page.keyboard.press('f');
  await expect(hud).toHaveAttribute('data-player-state', 'pinning');
  await expect(hud).toHaveAttribute('data-cover-established', 'true', { timeout: 12000 });
  await expect(page.getByTestId('control-deck')).toContainText('COVERING');
  await expect(page.getByText('TWO', { exact: true })).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: 'test-results/polish-physical-cover.png' });
  await expect(page.locator('.announcement')).toContainText('KICKOUT', { timeout: 10000 });
  await page.screenshot({ path: 'test-results/polish-kickout.png' });
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0');
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});
