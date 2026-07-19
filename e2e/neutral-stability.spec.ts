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
  await expect(hud.locator('[data-player-stance-profile]')).toHaveAttribute('data-player-stance-profile', 'combat');
  await expect.poll(async () => Number(await hud.locator('[data-player-facing-error]').getAttribute('data-player-facing-error')), { timeout: 5_000, intervals: [50, 100] }).toBeLessThan(.35);
  await expect(fallAudit).toHaveAttribute('data-unknown-falls', '0');
  await expect.poll(async () => Number(await hud.getAttribute('data-player-support-feet')), { timeout: 5_000, intervals: [50, 100] }).toBeGreaterThanOrEqual(1);
  await expect.poll(async () => Number(await hud.locator('[data-support-score]').getAttribute('data-support-score')), { timeout: 5_000, intervals: [50, 100] }).toBeGreaterThan(.55);

  const before = { x: Number(await hud.getAttribute('data-player-x')), z: Number(await hud.getAttribute('data-player-z')) };
  const walk = lab.getByRole('button', { name: 'WALK + STOP' });
  await page.evaluate(() => {
    const telemetry = document.querySelector('[data-player-movement-heading]');
    if (!telemetry) return;
    const observe = (): void => {
      const movement = Number(telemetry.getAttribute('data-player-movement-heading')); const combat = Number(telemetry.getAttribute('data-player-combat-facing'));
      const delta = Math.abs(Math.atan2(Math.sin(movement - combat), Math.cos(movement - combat)));
      if (delta > .65) document.documentElement.dataset.sawIndependentMovementAndCombatFacing = 'true';
    };
    new MutationObserver(observe).observe(telemetry, { attributes: true }); observe();
  });
  await walk.click(); await expect(walk).toBeEnabled({ timeout: 15_000 });
  const after = { x: Number(await hud.getAttribute('data-player-x')), z: Number(await hud.getAttribute('data-player-z')) };
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(.85);
  await expect(hud).toHaveAttribute('data-player-state', 'idle');
  await expect.poll(async () => Number(await hud.locator('[data-player-physics-speed]').getAttribute('data-player-physics-speed')), { timeout: 5_000, intervals: [50, 100] }).toBeLessThan(.25);
  await expect(page.locator('html')).toHaveAttribute('data-saw-independent-movement-and-combat-facing', 'true');
  await expect.poll(async () => Number(await hud.locator('[data-player-facing-error]').getAttribute('data-player-facing-error')), { timeout: 5_000, intervals: [50, 100] }).toBeLessThan(.35);
  await expect(fallAudit).toHaveAttribute('data-unknown-falls', '0');
  await expect(fallAudit).toHaveAttribute('data-unstable-without-cause-seconds', '0.000');
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0');

  for (const scenarioName of ['RUN + MOMENTUM', 'RUN + BRAKE', 'RAPID TURN']) {
    const scenario = lab.getByRole('button', { name: scenarioName });
    await scenario.click(); await expect(scenario).toBeEnabled({ timeout: 15_000 });
    await expect.poll(async () => hud.getAttribute('data-player-state'), { timeout: 5_000, intervals: [50, 100] }).toMatch(/idle|locomotion/);
    await expect(fallAudit).toHaveAttribute('data-unknown-falls', '0');
    await expect(fallAudit).toHaveAttribute('data-unstable-without-cause-seconds', '0.000');
    await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0');
  }
});

test('neutral soft separation resolves close overlap without a fall or emergency reset', async ({ page }) => {
  await page.goto('/?physicsLab=1');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: /^STANDARD/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();

  const hud = page.locator('.hud'); const lab = page.getByTestId('physics-lab'); const fallAudit = hud.locator('[data-unknown-falls]');
  await expect(hud).toHaveAttribute('data-physics-bodies', '32', { timeout: 30_000 });
  const separation = lab.getByRole('button', { name: 'SOFT SEPARATION' });
  await separation.click(); await expect(separation).toBeEnabled({ timeout: 15_000 });
  await expect.poll(async () => Math.hypot(
    Number(await hud.getAttribute('data-opponent-x')) - Number(await hud.getAttribute('data-player-x')),
    Number(await hud.getAttribute('data-opponent-z')) - Number(await hud.getAttribute('data-player-z')),
  ), { timeout: 8_000, intervals: [50, 100, 200] }).toBeGreaterThanOrEqual(.5);
  await expect(hud).toHaveAttribute('data-player-state', 'idle');
  await expect(fallAudit).toHaveAttribute('data-unknown-falls', '0');
  await expect(fallAudit).toHaveAttribute('data-unstable-without-cause-seconds', '0.000');
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0');
});
