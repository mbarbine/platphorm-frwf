import { expect, test } from '@playwright/test';

test.use({ video: 'on', trace: 'off', actionTimeout: 15000 });

test('keeps the wrestler visible in collision view and yields scripted movement to the player', async ({ page }) => {
  await page.goto('/?physicsLab=1');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();
  await expect(page.getByTestId('game-canvas')).toHaveAttribute('data-simulation-ready', 'true', { timeout: 45000 });
  const lab = page.getByTestId('physics-lab'); const hud = page.locator('.hud');
  await lab.getByRole('button', { name: 'COLLISION OVERLAY' }).click();
  await expect(lab).toHaveAttribute('data-lab-debug', 'true');
  await lab.getByRole('button', { name: 'MINIMIZE PHYSICS LAB' }).click();
  await page.screenshot({ path: 'test-results/collision-overlay-human.png' });
  await lab.getByRole('button', { name: 'SHOW PHYSICS LAB' }).click();
  await lab.getByRole('button', { name: 'TAKE CONTROL' }).click();
  await expect(lab).toHaveAttribute('data-lab-debug', 'false');
  await expect(lab).toHaveAttribute('data-minimized', 'true');
  await lab.getByRole('button', { name: 'SHOW PHYSICS LAB' }).click();
  await lab.getByRole('button', { name: 'RUN + MOMENTUM', exact: true }).click();
  await expect(lab).toHaveAttribute('data-lab-scenario', 'run');
  const startX = Number(await hud.getAttribute('data-player-x'));
  await page.keyboard.down('d');
  await expect(lab).toHaveAttribute('data-lab-scenario', 'idle');
  await expect.poll(async () => Number(await hud.getAttribute('data-player-x')), { timeout: 8000 }).toBeGreaterThan(startX + .3);
  await page.keyboard.up('d');
  await expect(hud).toHaveAttribute('data-player-state', 'idle');
  await page.waitForTimeout(350);
  const stoppedX = Number(await hud.getAttribute('data-player-x'));
  const stoppedZ = Number(await hud.getAttribute('data-player-z'));
  await page.waitForTimeout(500);
  const drift = Math.hypot(Number(await hud.getAttribute('data-player-x')) - stoppedX, Number(await hud.getAttribute('data-player-z')) - stoppedZ);
  expect(drift).toBeLessThan(.12);
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0');
});
