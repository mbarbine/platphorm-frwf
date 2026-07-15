import { expect, test } from '@playwright/test';

test('UI-free Toy Test preserves body control while removing score pressure', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = []; page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); }); page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?toyTest=1'); await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click(); await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click(); await page.getByRole('button', { name: /^SINGLES/ }).click(); await page.getByRole('button', { name: /^STANDARD/ }).click(); await page.getByRole('button', { name: 'START MATCH' }).click();
  const canvas = page.getByTestId('game-canvas'); await expect(canvas).toBeVisible(); await expect(canvas).toHaveAttribute('data-toy-test', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-game-input-ready', 'true', { timeout: 60_000 });
  await expect(canvas).toHaveAttribute('data-physics-bodies', '32', { timeout: 60_000 });
  await expect.poll(async () => Number(await canvas.getAttribute('data-physics-steps')), { timeout: 60_000, intervals: [100, 150, 500, 1_000] }).toBeGreaterThan(60);
  await expect(page.locator('.hud')).toHaveCount(0); await expect(page.locator('.tutorial')).toHaveCount(0); await expect(page.locator('.mobile-controls')).toHaveCount(0);
  const initialX = Number(await canvas.getAttribute('data-player-x')); const initialZ = Number(await canvas.getAttribute('data-player-z'));
  await page.evaluate(({ x, z }) => {
    const liveCanvas = document.querySelector('[data-testid="game-canvas"]'); if (!liveCanvas) return;
    const sample = (): void => {
      const displacement = Math.hypot(Number(liveCanvas.getAttribute('data-player-x')) - x, Number(liveCanvas.getAttribute('data-player-z')) - z);
      document.documentElement.dataset.maximumToyDisplacement = String(Math.max(Number(document.documentElement.dataset.maximumToyDisplacement ?? 0), displacement));
    };
    new MutationObserver(sample).observe(liveCanvas, { attributes: true }); sample();
  }, { x: initialX, z: initialZ });
  await page.keyboard.down('w'); await expect.poll(async () => Number(await page.locator('html').getAttribute('data-maximum-toy-displacement')), { timeout: 60_000, intervals: [100, 250, 500, 1_000] }).toBeGreaterThan(.75); await page.keyboard.up('w');
  await expect(canvas).toHaveAttribute('data-opponent-health', '100.0'); expect(errors).toEqual([]);
});
