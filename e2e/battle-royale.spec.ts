import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const enterBattleRoyale = async (page: Page): Promise<void> => {
  await page.goto('/');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  const battleMode = page.getByTestId('battle-royale-mode');
  await battleMode.click();
  await expect(battleMode).toHaveClass(/active/);
  await page.getByRole('button', { name: /START MATCH · BATTLE ROYALE/ }).click();
};

test('Battle Royale starts one real rig for all five wrestlers and produces AI contact', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

  await enterBattleRoyale(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const canvas = page.getByTestId('game-canvas'); const hud = page.locator('.hud'); const roster = page.getByTestId('battle-royale-roster');
  await expect(canvas).toHaveAttribute('data-match-mode', 'battle_royale');
  await expect(canvas).toHaveAttribute('data-active-wrestlers', '5');
  await expect(hud).toHaveAttribute('data-match-mode', 'battle_royale');
  await expect(roster).toHaveAttribute('data-remaining', '5');
  await expect(roster.locator('[data-fighter-slot]')).toHaveCount(5);
  await expect.poll(async () => Number(await hud.getAttribute('data-physics-bodies')), { timeout: 20_000 }).toBe(80);
  await expect.poll(async () => Number(await hud.getAttribute('data-physics-joints')), { timeout: 20_000 }).toBe(75);
  await expect.poll(async () => Number(await hud.locator('[data-landing-surfaces]').getAttribute('data-landing-surfaces')), { timeout: 20_000 }).toBeGreaterThanOrEqual(3);
  await expect.poll(async () => Number(await hud.getAttribute('data-match-seconds')), { timeout: 20_000 }).toBeGreaterThan(1);
  await expect.poll(async () => Number(await hud.getAttribute('data-total-damage')), { timeout: 35_000, intervals: [250, 500] }).toBeGreaterThan(0);
  await expect(page.locator('html')).toHaveAttribute('data-camera-shot', 'battle-royale-steady');
  await expect.poll(async () => Number(await page.locator('html').getAttribute('data-camera-fov')), { timeout: 20_000 }).toBeCloseTo(55, 1);
  const targetBox = await page.getByTestId('target-switch').boundingBox();
  expect(targetBox?.width).toBeGreaterThanOrEqual(44); expect(targetBox?.height).toBeGreaterThanOrEqual(44);
  expect(errors).toEqual([]);
});

test('Standard Singles keeps the directed broadcast and action camera', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

  await page.goto('/');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: /^SINGLES/ }).click();
  await page.getByRole('button', { name: /^STANDARD/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();

  const canvas = page.getByTestId('game-canvas');
  await expect(canvas).toHaveAttribute('data-match-mode', 'singles');
  await expect.poll(async () => Number(await canvas.getAttribute('data-physics-bodies')), { timeout: 40_000 }).toBe(32);
  await expect(page.locator('html')).toHaveAttribute('data-camera-shot', /broadcast|wide|ringside-x|ringside-z|table|strike|grapple|slam|corner|aerial|replay/, { timeout: 20_000 });
  await expect(page.locator('html')).not.toHaveAttribute('data-camera-shot', 'battle-royale-steady');
  expect(errors).toEqual([]);
});

test('five-way play keeps movement authoritative and gives the player target control', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

  await enterBattleRoyale(page);
  const hud = page.locator('.hud');
  await expect.poll(async () => Number(await hud.getAttribute('data-physics-bodies')), { timeout: 40_000 }).toBe(80);
  await expect(page.locator('html')).toHaveAttribute('data-game-input-ready', 'true', { timeout: 15_000 });
  await expect.poll(async () => Number(await hud.getAttribute('data-match-seconds')), { timeout: 15_000 }).toBeGreaterThan(.3);

  const originalTarget = await hud.getAttribute('data-player-target');
  await page.keyboard.press('Tab');
  await expect.poll(() => hud.getAttribute('data-player-target')).not.toBe(originalTarget);
  await expect(page.getByTestId('target-switch')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-camera-shot', 'battle-royale-steady');

  const startX = Number(await hud.getAttribute('data-player-x')); const startZ = Number(await hud.getAttribute('data-player-z'));
  await page.evaluate(({ x, z }) => {
    const root = document.documentElement; const hudNode = document.querySelector('.hud');
    if (!hudNode) return;
    const sample = (): void => {
      const input = document.querySelector('[data-player-intent-x]');
      const intent = Math.hypot(Number(input?.getAttribute('data-player-intent-x')), Number(input?.getAttribute('data-player-intent-z')));
      const displacement = Math.hypot(Number(hudNode.getAttribute('data-player-x')) - x, Number(hudNode.getAttribute('data-player-z')) - z);
      root.dataset.maximumBattleIntent = String(Math.max(Number(root.dataset.maximumBattleIntent ?? 0), intent));
      root.dataset.maximumBattleDisplacement = String(Math.max(Number(root.dataset.maximumBattleDisplacement ?? 0), displacement));
    };
    new MutationObserver(sample).observe(hudNode, { attributes: true, subtree: true }); sample();
  }, { x: startX, z: startZ });
  await page.keyboard.down('Shift'); await page.keyboard.down('w');
  await expect.poll(async () => Number(await page.locator('html').getAttribute('data-maximum-battle-intent')), { timeout: 15_000, intervals: [250, 500] }).toBeGreaterThan(.8);
  await expect.poll(async () => Number(await page.locator('html').getAttribute('data-maximum-battle-displacement')), { timeout: 20_000, intervals: [250, 500] }).toBeGreaterThan(.35);
  await page.keyboard.up('w'); await page.keyboard.up('Shift');
  expect(errors).toEqual([]);
});

test('controls remain live after the opening exchange and every active body stays above the deck', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await enterBattleRoyale(page);
  const hud = page.locator('.hud'); const html = page.locator('html');
  await expect.poll(async () => Number(await hud.getAttribute('data-match-seconds')), { timeout: 90_000, intervals: [250, 500, 1_000] }).toBeGreaterThan(9);
  const storeActionsBefore = Number(await html.getAttribute('data-store-action-count'));
  await page.keyboard.press('j');
  await expect.poll(async () => Number(await html.getAttribute('data-store-action-count')), { timeout: 15_000, intervals: [50, 100, 250] }).toBeGreaterThan(storeActionsBefore);
  await expect(hud.locator('[data-last-action]')).toHaveAttribute('data-last-action', 'quickStrike');

  const startX = Number(await hud.getAttribute('data-player-x')); const startZ = Number(await hud.getAttribute('data-player-z'));
  await page.keyboard.down('d');
  await expect.poll(async () => Math.hypot(Number(await hud.locator('[data-player-intent-x]').getAttribute('data-player-intent-x')), Number(await hud.locator('[data-player-intent-x]').getAttribute('data-player-intent-z'))), { timeout: 30_000, intervals: [100, 200, 400] }).toBeGreaterThan(.8);
  await expect.poll(async () => Math.hypot(Number(await hud.getAttribute('data-player-x')) - startX, Number(await hud.getAttribute('data-player-z')) - startZ), { timeout: 60_000, intervals: [100, 200, 400, 1_000] }).toBeGreaterThan(.25);
  await page.keyboard.up('d');
  await expect.poll(async () => Number(await hud.getAttribute('data-active-min-pelvis-y')), { timeout: 15_000, intervals: [100, 200, 400] }).toBeGreaterThanOrEqual(1.22);
  const staleFallStates = await page.getByTestId('battle-royale-roster').locator('[data-fighter-slot]').evaluateAll((rows) => rows.flatMap((row) => {
    const state = row.getAttribute('data-fighter-state') ?? '';
    const seconds = Number(row.getAttribute('data-fighter-state-seconds'));
    const limit = state === 'airborne' ? 4.5 : state === 'recovering' ? 5 : state === 'downed' ? 8 : Number.POSITIVE_INFINITY;
    return seconds > limit ? [`${row.getAttribute('data-fighter-slot')}:${state}:${seconds.toFixed(2)}`] : [];
  }));
  expect(staleFallStates, `active wrestlers stranded in fall/recovery states: ${staleFallStates.join(', ')}`).toEqual([]);
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0');
  await expect(hud.locator('[data-last-numerical-fault]')).not.toHaveAttribute('data-last-numerical-fault', 'below-deck-safe-reset');
  expect(errors).toEqual([]);
});
