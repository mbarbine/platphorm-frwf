import { expect, test } from '@playwright/test';

test('chooses and releases a physical throw through ordinary wrestling controls', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  // Use the game's ordinary performance setting for timing-sensitive inputs
  // in software-rendered browser runs; the physical simulation is unchanged.
  await page.getByRole('button', { name: 'SETTINGS', exact: true }).click();
  await page.getByRole('combobox', { name: 'Graphics quality' }).selectOption('performance');
  await page.getByRole('button', { name: 'DONE', exact: true }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: /^EASY/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();
  const hud = page.locator('.hud');
  await expect(page.getByTestId('game-canvas')).toHaveAttribute('data-simulation-ready', 'true', { timeout: 45000 });
  await expect(page.locator('html')).toHaveAttribute('data-game-input-ready', 'true');
  await page.keyboard.press('l');
  await expect.poll(() => hud.getAttribute('data-grapple-phase'), { timeout: 12000, intervals: [20] }).toBe('clinch');
  await expect(hud).toHaveAttribute('data-grapple-grips', '2');
  await page.keyboard.press('k');
  await expect(hud).toHaveAttribute('data-player-move', 'slam');
  await expect.poll(() => hud.getAttribute('data-grapple-phase'), { timeout: 10000, intervals: [20] }).toBe('lift');
  await expect(page.getByTestId('control-deck').locator('[data-control="quick"]')).toHaveAttribute('data-move-label', 'RELEASE THROW');
  await page.keyboard.press('j');
  await expect(hud.locator('[data-last-action]')).toHaveAttribute('data-last-action', 'quickStrike');
  await expect(hud.locator('[data-last-action]')).toHaveAttribute('data-last-action-status', 'executed');
  await expect.poll(async () => Number(await hud.getAttribute('data-player-grapples')), { timeout: 20000 }).toBeGreaterThan(0);
  await expect.poll(async () => Number(await hud.getAttribute('data-opponent-health'))).toBeLessThan(100);
  await page.screenshot({ path: 'test-results/polish-throw-landing.png' });
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0');
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});
