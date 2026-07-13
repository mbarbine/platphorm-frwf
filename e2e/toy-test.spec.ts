import { expect, test } from '@playwright/test';

test('UI-free Toy Test preserves body control while removing score pressure', async ({ page }) => {
  const errors: string[] = []; page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); }); page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?toyTest=1'); await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click(); await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click(); await page.getByRole('button', { name: /^STANDARD/ }).click(); await page.getByRole('button', { name: 'START MATCH' }).click();
  const canvas = page.getByTestId('game-canvas'); await expect(canvas).toBeVisible(); await expect(canvas).toHaveAttribute('data-toy-test', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-game-input-ready', 'true');
  await expect(page.locator('.hud')).toHaveCount(0); await expect(page.locator('.tutorial')).toHaveCount(0); await expect(page.locator('.mobile-controls')).toHaveCount(0);
  const initialX = Number(await canvas.getAttribute('data-player-x')); const initialZ = Number(await canvas.getAttribute('data-player-z'));
  await page.keyboard.down('w'); await expect.poll(async () => Math.hypot(Number(await canvas.getAttribute('data-player-x')) - initialX, Number(await canvas.getAttribute('data-player-z')) - initialZ), { timeout: 6_000, intervals: [100, 150] }).toBeGreaterThan(.75); await page.keyboard.up('w');
  await expect(canvas).toHaveAttribute('data-opponent-health', '100.0'); expect(errors).toEqual([]);
});
