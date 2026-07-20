import { expect, test } from '@playwright/test';

test('back recovery physically plants a boot and releases controls', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto('/?physicsLab=1');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: /^STANDARD/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();

  const hud = page.locator('.hud'); const lab = page.getByTestId('physics-lab');
  await expect(hud).toHaveAttribute('data-physics-bodies', '32', { timeout: 30_000 });
  await lab.getByRole('button', { name: 'BACK GET-UP' }).click();
  await expect(lab).toHaveAttribute('data-lab-scenario', 'idle', { timeout: 120_000 });
  await expect.poll(async () => ({
    state: await hud.getAttribute('data-player-state'),
    balance: Number(await hud.getAttribute('data-player-balance')),
    upright: Number(await hud.getAttribute('data-player-upright')),
    supportFeet: Number(await hud.getAttribute('data-player-support-feet')),
    pelvisY: Number(await hud.getAttribute('data-player-pelvis-y')),
    leftFootY: Number(await hud.getAttribute('data-player-left-foot-y')),
    rightFootY: Number(await hud.getAttribute('data-player-right-foot-y')),
  }), { timeout: 120_000, intervals: [80, 160, 320, 640, 1_000] }).toMatchObject({ state: 'idle' });
  await expect.poll(async () => Number(await hud.getAttribute('data-player-support-feet')), { timeout: 15_000, intervals: [80, 160, 320, 640] }).toBeGreaterThanOrEqual(1);
  await expect.poll(async () => Math.abs(Number(await page.locator('html').getAttribute('data-player-lean-forward'))), { timeout: 10_000 }).toBeLessThan(.03);
  await expect.poll(async () => Math.abs(Number(await page.locator('html').getAttribute('data-player-lean-side'))), { timeout: 10_000 }).toBeLessThan(.03);
  expect(Number(await hud.getAttribute('data-player-upright'))).toBeGreaterThan(.65);
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0');
});
