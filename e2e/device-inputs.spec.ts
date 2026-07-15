import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const enterLabMatch = async (page: Page): Promise<void> => {
  await page.goto('/?physicsLab=1');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();
  await expect(page.locator('.hud')).toHaveAttribute('data-physics-bodies', '32', { timeout: 30_000 });
};

test('standard gamepad axes, run trigger, and quick attack drive the live match', async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
    const pad = { axes: [0, 0, 0, 0], buttons, connected: true, id: 'Ringfall deterministic standard pad', index: 0, mapping: 'standard', timestamp: 0, vibrationActuator: null, hapticActuators: [] };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
    (window as Window & { __ringfallPad?: typeof pad }).__ringfallPad = pad;
  });
  await enterLabMatch(page);
  const hud = page.locator('.hud');
  await page.evaluate(() => window.dispatchEvent(new Event('gamepadconnected')));
  const before = { x: Number(await hud.getAttribute('data-player-x')), z: Number(await hud.getAttribute('data-player-z')) };
  await page.evaluate(() => {
    const pad = (window as Window & { __ringfallPad?: { axes: number[]; buttons: Array<{ pressed: boolean; touched: boolean; value: number }> } }).__ringfallPad;
    if (!pad) return; pad.axes[0] = .92; const trigger = pad.buttons[7]; if (trigger) { trigger.pressed = true; trigger.value = 1; }
  });
  await expect(page.locator('.context-hint')).toContainText('GAMEPAD ACTIVE'); await page.waitForTimeout(900);
  const after = { x: Number(await hud.getAttribute('data-player-x')), z: Number(await hud.getAttribute('data-player-z')) };
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(.15);
  await page.evaluate(() => {
    const pad = (window as Window & { __ringfallPad?: { axes: number[]; buttons: Array<{ pressed: boolean; touched: boolean; value: number }> } }).__ringfallPad;
    if (!pad) return; pad.axes[0] = 0; const trigger = pad.buttons[7]; if (trigger) { trigger.pressed = false; trigger.value = 0; }
  });
  await expect.poll(async () => hud.getAttribute('data-player-state'), { timeout: 20_000, intervals: [100, 200] }).toMatch(/idle|locomotion/);
  await expect(hud).toHaveAttribute('data-player-move', '', { timeout: 10_000 });
  await page.evaluate(() => { const button = (window as Window & { __ringfallPad?: { buttons: Array<{ pressed: boolean; value: number }> } }).__ringfallPad?.buttons[2]; if (button) { button.pressed = true; button.value = 1; } });
  await expect(hud.locator('[data-last-action]')).toHaveAttribute('data-last-action', 'quickStrike', { timeout: 15_000 });
  await expect(hud.locator('[data-last-action]')).toHaveAttribute('data-last-action-source', 'gamepad', { timeout: 15_000 });
  await expect(hud.locator('[data-last-action]')).toHaveAttribute('data-last-action-status', 'executed', { timeout: 15_000 });
  await page.evaluate(() => { const button = (window as Window & { __ringfallPad?: { buttons: Array<{ pressed: boolean; value: number }> } }).__ringfallPad?.buttons[2]; if (button) { button.pressed = false; button.value = 0; } });
  await expect(hud.locator('[data-action-executed]')).not.toHaveAttribute('data-action-executed', '0');
});

test('WebXR-capable browsers expose the arena entry without loading XR before the match', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'xr', { configurable: true, value: { isSessionSupported: async (mode: string) => mode === 'immersive-vr' } });
  });
  await enterLabMatch(page);
  await expect(page.getByTestId('xr-entry')).toBeVisible();
  await expect(page.getByTestId('xr-entry')).toContainText('ENTER ARENA XR');
});
