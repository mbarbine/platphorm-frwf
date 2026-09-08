import { expect, test } from '@playwright/test';

test.use({ video: 'on', trace: 'off' });

test('Chad gets up on backstage furniture through the visible recovery control', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?physicsLab=1');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();
  const canvas = page.getByTestId('game-canvas'); const hud = page.locator('.hud');
  await expect(canvas).toHaveAttribute('data-simulation-ready', 'true', { timeout: 45000 });
  const lab = page.getByTestId('physics-lab');
  await lab.getByText('PAIR / SEED / STAMINA / MASS', { exact: true }).click();
  await lab.getByLabel('VENUE', { exact: true }).selectOption('backstage');
  await lab.getByLabel('PLAYER', { exact: true }).selectOption('chad');
  await lab.getByRole('button', { name: 'LOAD PAIR' }).click();
  await expect(canvas).toHaveAttribute('data-combat-venue', 'backstage');
  await expect(canvas).toHaveAttribute('data-simulation-ready', 'true', { timeout: 45000 });
  await lab.getByRole('button', { name: 'TABLE — MANUAL GET-UP' }).click();
  await expect(hud).toHaveAttribute('data-player-state', 'downed');
  await page.keyboard.press('Space');
  await expect(hud).toHaveAttribute('data-player-state', 'idle', { timeout: 15000 });
  expect(Number(await hud.getAttribute('data-player-upright'))).toBeGreaterThan(.9);
  expect(Number(await hud.getAttribute('data-player-support-feet'))).toBeGreaterThan(0);
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0');
  await page.keyboard.press('Escape');
  await page.screenshot({ path: 'test-results/chad-table-recovered.png' });
  expect(errors).toEqual([]);
});
