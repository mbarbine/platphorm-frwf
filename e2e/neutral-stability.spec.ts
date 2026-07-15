import { expect, test } from '@playwright/test';

test('neutral standing, walk, and stop retain real support with no unknown fall', async ({ page }) => {
  await page.goto('/?physicsLab=1');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: /^STANDARD/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();

  const hud = page.locator('.hud'); const lab = page.getByTestId('physics-lab');
  const fallAudit = hud.locator('[data-unknown-falls]');
  await expect(hud).toHaveAttribute('data-physics-bodies', '32', { timeout: 30_000 });

  const standing = lab.getByRole('button', { name: 'STANDING STABILITY' });
  await standing.click(); await expect(standing).toBeEnabled({ timeout: 15_000 });
  await expect(hud).toHaveAttribute('data-player-state', 'idle');
  await expect(fallAudit).toHaveAttribute('data-unknown-falls', '0');
  await expect.poll(async () => Number(await hud.getAttribute('data-player-support-feet')), { timeout: 5_000, intervals: [50, 100] }).toBeGreaterThanOrEqual(1);
  await expect.poll(async () => Number(await hud.locator('[data-support-score]').getAttribute('data-support-score')), { timeout: 5_000, intervals: [50, 100] }).toBeGreaterThan(.55);

  const before = { x: Number(await hud.getAttribute('data-player-x')), z: Number(await hud.getAttribute('data-player-z')) };
  const walk = lab.getByRole('button', { name: 'WALK + STOP' });
  await walk.click(); await expect(walk).toBeEnabled({ timeout: 15_000 });
  const after = { x: Number(await hud.getAttribute('data-player-x')), z: Number(await hud.getAttribute('data-player-z')) };
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(.85);
  await expect(hud).toHaveAttribute('data-player-state', 'idle');
  await expect.poll(async () => Number(await hud.locator('[data-player-physics-speed]').getAttribute('data-player-physics-speed')), { timeout: 5_000, intervals: [50, 100] }).toBeLessThan(.25);
  await expect(fallAudit).toHaveAttribute('data-unknown-falls', '0');
  await expect(fallAudit).toHaveAttribute('data-unstable-without-cause-seconds', '0.000');
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0');
});
