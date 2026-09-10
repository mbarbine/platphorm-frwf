import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function enter(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: 'START MATCH', exact: true }).click();
  await expect(page.locator('.hud')).toHaveAttribute('data-physics-bodies', '32', { timeout: 30_000 });
  await expect(page.locator('html')).toHaveAttribute('data-game-input-ready', 'true');
}

test('match fills the viewport and settings preserve the paused physical world', async ({ page }) => {
  await enter(page);
  const canvas = page.locator('.match-screen canvas');
  await expect.poll(async () => (await canvas.boundingBox())?.height ?? 0).toBeGreaterThan(500);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'RESUME', exact: true })).toBeVisible();
  const before = await page.locator('.hud').evaluate(e => ({ x: e.getAttribute('data-player-x'), y: e.getAttribute('data-player-pelvis-y'), health: e.getAttribute('data-player-health') }));
  await page.getByRole('button', { name: 'SETTINGS', exact: true }).click();
  await expect(page.getByRole('slider', { name: /Music/ })).toBeVisible();
  await page.getByRole('button', { name: 'DONE', exact: true }).click();
  await expect(page.locator('.hud')).toHaveAttribute('data-physics-bodies', '32');
  expect(await page.locator('.hud').evaluate(e => ({ x: e.getAttribute('data-player-x'), y: e.getAttribute('data-player-pelvis-y'), health: e.getAttribute('data-player-health') }))).toEqual(before);
  await page.getByRole('button', { name: 'RESUME', exact: true }).click();
  await page.keyboard.press('j');
  await expect(page.locator('.hud [data-last-action]')).toHaveAttribute('data-last-action', 'quickStrike');
});

test('actual WebGL context loss pauses play and shows a recovery action', async ({ page }) => {
  await enter(page);
  const supported = await page.locator('.match-screen canvas').evaluate((node) => {
    const gl = (node as HTMLCanvasElement).getContext('webgl2');
    const extension = gl?.getExtension('WEBGL_lose_context');
    if (!extension) return false;
    extension.loseContext();
    return true;
  });
  expect(supported, 'Chromium must expose the context-loss test extension').toBe(true);
  await expect(page.getByRole('alert')).toContainText('GRAPHICS INTERRUPTED');
  await expect(page.getByRole('button', { name: 'RELOAD GAME', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'RESUME', exact: true })).toBeVisible();
});
