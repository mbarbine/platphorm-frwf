import { expect, test } from '@playwright/test';

test('Bodyworks lab exposes live Rapier diagnostics and drives real jump/walk input', async ({ page }) => {
  const errors: string[] = []; page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); }); page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?physicsLab=1');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: /^STANDARD/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();
  const hud = page.locator('.hud'); const lab = page.getByTestId('physics-lab');
  await expect(lab).toBeVisible(); await expect(hud).toHaveAttribute('data-physics-bodies', '32', { timeout: 30_000 }); await expect(hud).toHaveAttribute('data-physics-joints', '30');
  const initialY = Number(await hud.getAttribute('data-player-pelvis-y')); let apex = initialY;
  await page.keyboard.press('c');
  await expect.poll(async () => { apex = Math.max(apex, Number(await hud.getAttribute('data-player-pelvis-y'))); return apex; }, { timeout: 7_000, intervals: [50, 100] }).toBeGreaterThan(initialY + .2);
  await expect(lab.getByRole('button', { name: 'WALK + STOP' })).toBeEnabled({ timeout: 3_000 });
  const initialX = Number(await hud.getAttribute('data-player-x')); const initialZ = Number(await hud.getAttribute('data-player-z'));
  await lab.getByRole('button', { name: 'WALK + STOP' }).click();
  await expect.poll(async () => Math.hypot(Number(await hud.getAttribute('data-player-x')) - initialX, Number(await hud.getAttribute('data-player-z')) - initialZ), { timeout: 2_100, intervals: [100] }).toBeGreaterThan(.35);
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0'); expect(errors).toEqual([]);
});
