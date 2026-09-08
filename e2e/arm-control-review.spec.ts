import { expect, test } from '@playwright/test';

test.use({ video: 'on', trace: 'off' });

test('records idle, directional movement, guard and punches through player controls', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: /^EASY/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();
  await expect(page.getByTestId('game-canvas')).toHaveAttribute('data-simulation-ready', 'true', { timeout: 45000 });
  const tutorial = page.getByRole('button', { name: 'Close tutorial' });
  if (await tutorial.isVisible()) {
    // The nonmodal coach dismisses itself. Never wait a whole match for a
    // button that disappeared between the visibility read and the click.
    try { await tutorial.click({ timeout: 1500 }); }
    catch (error) { if (await tutorial.isVisible()) throw error; }
  }
  // These holds record the visible motion, rather than skipping to a pose.
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'test-results/arms-idle.png' });
  for (const key of ['w', 'd', 's', 'a']) {
    await page.keyboard.down(key); await page.waitForTimeout(600); await page.keyboard.up(key);
  }
  await page.keyboard.down('i');
  await expect(page.locator('.hud')).toHaveAttribute('data-player-state', 'blocking');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/arms-guard.png' });
  await page.keyboard.up('i');
  for (let i = 0; i < 3; i++) { await page.keyboard.press('j'); await page.waitForTimeout(800); }
  await page.screenshot({ path: 'test-results/arms-after-punches.png' });
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});
