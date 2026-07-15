import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const enterBattleRoyale = async (page: Page): Promise<void> => {
  await page.goto('/');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  const battleMode = page.getByTestId('battle-royale-mode');
  await expect(battleMode).toHaveClass(/active/);
  await expect(battleMode).toContainText('DEFAULT');
  await page.getByRole('button', { name: /START MATCH · BATTLE ROYALE/ }).click();
};

test('Battle Royale is the default and starts one real rig for all five wrestlers', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

  await enterBattleRoyale(page);
  const canvas = page.getByTestId('game-canvas'); const hud = page.locator('.hud'); const roster = page.getByTestId('battle-royale-roster');
  await expect(canvas).toHaveAttribute('data-match-mode', 'battle_royale');
  await expect(canvas).toHaveAttribute('data-active-wrestlers', '5');
  await expect(hud).toHaveAttribute('data-match-mode', 'battle_royale');
  await expect(roster).toHaveAttribute('data-remaining', '5');
  await expect(roster.locator('[data-fighter-slot]')).toHaveCount(5);
  await expect.poll(async () => Number(await hud.getAttribute('data-physics-bodies')), { timeout: 20_000 }).toBe(80);
  await expect.poll(async () => Number(await hud.getAttribute('data-physics-joints')), { timeout: 20_000 }).toBe(75);
  await expect.poll(async () => Number(await hud.getAttribute('data-match-seconds')), { timeout: 20_000 }).toBeGreaterThan(1);
  await expect.poll(async () => Number(await hud.getAttribute('data-total-damage')), { timeout: 35_000, intervals: [250, 500] }).toBeGreaterThan(0);
  await expect(page.locator('html')).toHaveAttribute('data-camera-shot', /wide|strike|grapple|slam|aerial|corner/);
  expect(errors).toEqual([]);
});

test('five-way play keeps movement authoritative and gives the player target control', async ({ page }) => {
  test.setTimeout(120_000);
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

  const startX = Number(await hud.getAttribute('data-player-x')); const startZ = Number(await hud.getAttribute('data-player-z'));

  await page.keyboard.down('Shift'); await page.keyboard.down('w');
  let maximumIntent = 0; let maximumDisplacement = 0;
  for (let sample = 0; sample < 24; sample += 1) {
    const telemetry = await page.evaluate(() => {
      const telemetry = document.querySelector('[data-player-intent-x]');
      const hud = document.querySelector('.hud');
      return {
        intent: Math.hypot(Number(telemetry?.getAttribute('data-player-intent-x')), Number(telemetry?.getAttribute('data-player-intent-z'))),
        x: Number(hud?.getAttribute('data-player-x')),
        z: Number(hud?.getAttribute('data-player-z')),
      };
    });
    maximumIntent = Math.max(maximumIntent, telemetry.intent);
    maximumDisplacement = Math.max(maximumDisplacement, Math.hypot(telemetry.x - startX, telemetry.z - startZ));
    await page.waitForTimeout(50);
  }
  await page.keyboard.up('w'); await page.keyboard.up('Shift');
  expect(maximumIntent).toBeGreaterThan(.8);
  expect(maximumDisplacement).toBeGreaterThan(.35);
  expect(errors).toEqual([]);
});
