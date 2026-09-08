import { expect, test } from '@playwright/test';

const browserName = process.env.PLAYWRIGHT_BROWSER === 'webkit' ? 'webkit' : 'chromium';
test.use({ browserName, hasTouch: true, isMobile: true, viewport: { width: 375, height: 640 } });
test.describe(`phone entry in ${browserName}`, () => {

    test('selects Chad with visible lock-in controls and reaches a touch-controlled match', async ({ page }) => {
      test.setTimeout(180_000);
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('/');
      await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).tap();
      await page.getByRole('button', { name: 'PLAY', exact: true }).tap();
      await page.getByRole('button', { name: /^CHAD “THE CLAW” KINSEY/ }).tap();
      const selectedCard = await page.getByRole('button', { name: /^CHAD “THE CLAW” KINSEY/ }).boundingBox();
      expect(selectedCard?.height).toBeGreaterThanOrEqual(60);
      const lock = page.getByRole('button', { name: /LOCK IN CHAD/ });
      // These are viewport assertions before Playwright can auto-scroll a
      // clipped button. This catches the real phone failure at fighter select.
      await expect(lock).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole('button', { name: 'BACK', exact: true })).toBeInViewport({ ratio: 1 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const lockBox = await lock.boundingBox();
      if (!lockBox) throw new Error('Lock-in has no layout box');
      expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.textContent, {
        x: lockBox.x + lockBox.width / 2, y: lockBox.y + lockBox.height / 2,
      })).toContain('LOCK IN CHAD');
      await page.screenshot({ path: `test-results/mobile-select-${browserName}.png` });
      await lock.tap();
      await page.getByRole('button', { name: 'START MATCH', exact: true }).tap();
      const hud = page.locator('.hud'); const controls = page.getByTestId('mobile-controls');
      await expect(hud).toHaveAttribute('data-physics-bodies', '32', { timeout: 45_000 });
      await expect(page.getByTestId('game-canvas')).toHaveAttribute('data-simulation-ready', 'true');
      await expect(controls).toBeVisible();
      await expect(controls.getByRole('group', { name: 'Movement joystick' })).toBeInViewport({ ratio: 1 });
      const pause = controls.getByRole('button', { name: 'Pause match' });
      await expect(pause).toBeInViewport({ ratio: 1 });
      await pause.tap();
      await expect(page.getByRole('button', { name: 'RESUME', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'SETTINGS', exact: true }).tap();
      await expect(page.getByRole('slider', { name: /Music/ })).toBeVisible();
      await page.getByRole('button', { name: 'DONE', exact: true }).tap();
      await page.getByRole('button', { name: 'RESUME', exact: true }).tap();
      await expect(page.locator('.pause-overlay')).toHaveCount(0);
      await expect(hud).toHaveAttribute('data-physics-bodies', '32');
      await page.setViewportSize({ width: 812, height: 375 });
      await expect(controls.getByRole('group', { name: 'Movement joystick' })).toBeInViewport({ ratio: 1 });
      await pause.tap();
      await page.getByRole('button', { name: 'QUIT TO MENU', exact: true }).tap();
      await page.getByRole('button', { name: 'PLAY', exact: true }).tap();
      await expect(page.getByRole('button', { name: /LOCK IN CHAD/ })).toBeInViewport({ ratio: 1 });
      expect(errors).toEqual([]);
    });
});
