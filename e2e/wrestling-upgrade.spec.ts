import { expect, test } from '@playwright/test';

test('controlled Bodyworks scenarios prove a physical slam, staged climb, taunt, and top-rope dive', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?physicsLab=1');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: /^STANDARD/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();

  const hud = page.locator('.hud'); const lab = page.getByTestId('physics-lab'); const deck = page.getByTestId('control-deck'); const telemetry = hud.locator('[data-player-climb-stage]'); const momentum = hud.locator('[data-player-momentum]');
  await expect(hud).toHaveAttribute('data-physics-bodies', '32', { timeout: 30_000 });
  const slam = lab.getByRole('button', { name: 'BODY SLAM' });
  await slam.click();
  await expect.poll(async () => await deck.getAttribute('data-control-state'), { timeout: 4_000, intervals: [50, 100] }).toMatch(/SLAM|GRAPPLE/);
  await expect(deck.locator('[data-control="grapple"]')).toHaveClass(/is-active/);
  await expect.poll(async () => Number(await hud.getAttribute('data-grip-creates')), { timeout: 12_000, intervals: [100, 200] }).toBeGreaterThanOrEqual(2);
  await expect.poll(async () => Number(await hud.getAttribute('data-player-grapples')), { timeout: 25_000, intervals: [200, 400] }).toBeGreaterThan(0);
  const replay = page.getByRole('button', { name: 'SKIP REPLAY' });
  if (await replay.isVisible()) await replay.click();

  const climb = lab.getByRole('button', { name: 'CLIMB + TAUNT' });
  await expect(climb).toBeEnabled({ timeout: 12_000 }); await climb.click();
  await expect.poll(async () => Number(await telemetry.getAttribute('data-player-climb-stage')), { timeout: 10_000, intervals: [100, 200] }).toBe(3);
  await expect.poll(async () => await hud.getAttribute('data-player-move'), { timeout: 8_000, intervals: [100, 150] }).toBe('taunt');
  await expect(deck.locator('[data-control="taunt"]')).toHaveClass(/is-active/); await expect(deck).toContainText('TOP-ROPE DIVE');
  await page.screenshot({ path: '/tmp/frwf-wrestling-upgrade.png' });
  await expect.poll(async () => Number(await momentum.getAttribute('data-player-momentum')), { timeout: 25_000, intervals: [200, 400] }).toBeGreaterThan(0);

  const dive = lab.getByRole('button', { name: 'TOP-ROPE DIVE' });
  await expect(dive).toBeEnabled({ timeout: 12_000 }); await dive.click();
  await expect.poll(async () => await hud.getAttribute('data-player-move'), { timeout: 12_000, intervals: [100, 200] }).toBe('aerial');
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0');
  expect(errors).toEqual([]);
});
