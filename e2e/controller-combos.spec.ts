import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('reevaluates visible hit chains through live input and solved contacts', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?physicsLab=1');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: /^SINGLES / }).click({ timeout: 10_000 });
  await page.getByRole('button', { name: /^STANDARD / }).click({ timeout: 10_000 });
  await page.getByRole('button', { name: 'START MATCH' }).click();
  const hud = page.locator('.hud'); const lab = page.getByTestId('physics-lab');
  await expect(hud).toHaveAttribute('data-physics-bodies', '32', { timeout: 45_000 });
  await lab.getByRole('button', { name: 'STANDING STABILITY', exact: true }).click();
  await expect(lab).toHaveAttribute('data-lab-scenario', 'idle', { timeout: 40_000 });
  await page.screenshot({ path: testInfo.outputPath('01-fuller-roster.png') });
  await lab.getByRole('button', { name: 'SIX PUNCHES · HIT CONFIRM', exact: true }).click();
  await lab.getByRole('button', { name: 'MINIMIZE PHYSICS LAB', exact: true }).click();
  await expect(page.getByTestId('hit-combo')).toHaveAttribute('data-hits', '6', { timeout: 90_000 });
  await page.screenshot({ path: testInfo.outputPath('02-confirmed-chain.png') });
  await expect(lab).toHaveAttribute('data-lab-scenario', 'idle', { timeout: 90_000 });
  await lab.getByRole('button', { name: 'SHOW PHYSICS LAB', exact: true }).click();
  const download = page.waitForEvent('download');
  await lab.getByRole('button', { name: 'EXPORT BASELINE' }).click();
  const artifact = await download; const file = testInfo.outputPath('six-punch-baseline.json'); await artifact.saveAs(file);
  const baseline = JSON.parse(await readFile(file, 'utf8')) as { version: number; maximumConfirmedHits: number; samples: Array<{ move: string | null; damage: number; upright: number; hits: number }> };
  expect(baseline.version).toBe(2);
  expect(baseline.maximumConfirmedHits).toBe(6);
  expect(new Set(baseline.samples.map(sample => sample.move)).size).toBeGreaterThanOrEqual(4);
  expect(baseline.samples.some(sample => sample.damage > 0)).toBe(true);
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0');
  await expect(lab).toHaveAttribute('data-lab-numerical-faults', '0');
  expect(errors).toEqual([]);
});

test('standard controller punches and kicks land in a normal live bout', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    const pad = { axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })), connected: true, id: 'FRWF release test standard controller', index: 0, mapping: 'standard', timestamp: 0, vibrationActuator: null, hapticActuators: [] };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
    (window as Window & { testPad?: typeof pad }).testPad = pad;
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: /^SINGLES / }).click({ timeout: 10_000 });
  await page.getByRole('button', { name: /^EASY / }).click({ timeout: 10_000 });
  await page.getByRole('button', { name: 'START MATCH' }).click();
  const hud = page.locator('.hud'); const feedback = hud.locator('[data-last-action]');
  await expect(hud).toHaveAttribute('data-physics-bodies', '32', { timeout: 45_000 });
  await expect(page.getByTestId('physics-lab')).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event('gamepadconnected')));
  const observed = new Set<string>();
  for (const index of [2, 2, 3, 2, 2, 3, 2, 2]) {
    await expect(hud).toHaveAttribute('data-player-state', /^(idle|locomotion|attacking|staggered|downed)$/, { timeout: 30_000 });
    const before = await hud.locator('[data-attack-sequence]').getAttribute('data-attack-sequence');
    await page.evaluate(buttonIndex => {
      const pad = (window as Window & { testPad?: { buttons: Array<{ pressed: boolean; value: number }> } }).testPad;
      const button = pad?.buttons[buttonIndex]; if (button) { button.pressed = true; button.value = 1; }
    }, index);
    await expect(feedback).toHaveAttribute('data-last-action-source', 'gamepad', { timeout: 20_000 });
    await expect(feedback).toHaveAttribute('data-last-action', index === 2 ? 'quickStrike' : 'heavyStrike', { timeout: 20_000 });
    // Hold through at least one rendered/simulated input sample on a slow GPU.
    await page.waitForTimeout(700);
    await page.evaluate(buttonIndex => {
      const button = (window as Window & { testPad?: { buttons: Array<{ pressed: boolean; value: number }> } }).testPad?.buttons[buttonIndex];
      if (button) { button.pressed = false; button.value = 0; }
    }, index);
    await expect(hud.locator('[data-attack-sequence]')).not.toHaveAttribute('data-attack-sequence', before ?? '0', { timeout: 20_000 });
    const move = await hud.locator('[data-attack-move]').getAttribute('data-attack-move'); if (move) observed.add(move);
    await expect(hud).toHaveAttribute('data-player-state', /^(idle|locomotion|staggered|downed)$/, { timeout: 30_000 });
  }
  expect(observed.has('jab') || observed.has('combo')).toBe(true);
  expect([...observed].some(move => move.includes('kick'))).toBe(true);
  await expect.poll(async () => Number(await hud.getAttribute('data-opponent-health')), { timeout: 20_000 }).toBeLessThan(100);
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0');
  await page.screenshot({ path: testInfo.outputPath('03-controller-live-bout.png') });
  await testInfo.attach('observed-controller-moves', { body: JSON.stringify([...observed]), contentType: 'application/json' });
});
