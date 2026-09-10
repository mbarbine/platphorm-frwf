import { expect, test } from '@playwright/test';

test.use({ video: 'on', trace: 'off', actionTimeout: 15000 });

test('records a connected source punch and kick through ordinary attack keys', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?physicsLab=1');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();
  await expect(page.getByTestId('game-canvas')).toHaveAttribute('data-simulation-ready', 'true', { timeout: 45000 });
  const lab = page.getByTestId('physics-lab'); const hud = page.locator('.hud');
  for (const [key, name] of [['j', 'jab'], ['k', 'front-kick']] as const) {
    // The lab places the pair but sends no attack. Damage must follow the
    // ordinary key press, while the video retains the actual physical motion.
    await lab.getByRole('button', { name: 'CLOSE-RANGE INPUT', exact: true }).click();
    await expect(lab).toHaveAttribute('data-lab-scenario', 'idle');
    await expect(hud).toHaveAttribute('data-opponent-health', '100.0');
    await lab.getByRole('button', { name: 'MINIMIZE PHYSICS LAB' }).click();
    await page.keyboard.press(key);
    await expect.poll(async () => Number(await hud.getAttribute('data-opponent-health')), { timeout: 10000 }).toBeLessThan(100);
    await expect(hud).toHaveAttribute('data-player-state', 'idle', { timeout: 10000 });
    expect(Number(await hud.getAttribute('data-player-upright'))).toBeGreaterThan(.9);
    await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0');
    await page.screenshot({ path: `test-results/source-${name}-connected.png` });
    await lab.getByRole('button', { name: 'SHOW PHYSICS LAB' }).click();
  }
  expect(errors).toEqual([]);
});
