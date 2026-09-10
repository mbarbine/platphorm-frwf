import { expect, test } from '@playwright/test';

const browserName = process.env.PLAYWRIGHT_BROWSER === 'webkit' ? 'webkit' : 'chromium';
test.use({ browserName });
for (const phone of [false, true]) test.describe(phone ? 'Phone showground' : 'Desktop showground', () => {
  test.use({ viewport: phone ? { width: 375, height: 640 } : { width: 1280, height: 800 }, hasTouch: phone, isMobile: phone });
  test('walks to a rival, enters a bout, returns and restores local progress', async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
    await page.getByRole('button', { name: 'EXPLORE SHOWGROUND' }).click();
    await page.getByRole('button', { name: 'LOCK IN ATLAS REX' }).click();
    const world = page.getByTestId('showground');
    await expect(world).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-game-input-ready', 'true', { timeout: 20000 });
    if (phone) {
      await page.getByRole('button', { name: 'CIRCUIT', exact: true }).click();
      const circuit = page.getByRole('complementary', { name: 'Local wrestling circuit' });
      expect(await world.evaluate(el => getComputedStyle(el).touchAction)).toBe('auto');
      expect(await circuit.evaluate(el => getComputedStyle(el).touchAction)).toBe('pan-y');
      const finale = circuit.locator('article').last();
      await finale.scrollIntoViewIfNeeded();
      await expect(finale).toBeInViewport();
      await expect(finale.getByRole('button', { name: 'TRACK ENCOUNTER' })).toBeDisabled();
      await page.screenshot({ path: `test-results/circuit-phone-scroll-${browserName}.png` });
      await page.getByRole('button', { name: 'Close circuit' }).click();
    }
    const z = async () => Number(await world.getAttribute('data-world-z'));
    if (phone) {
      const joystick = page.getByRole('group', { name: 'Explore movement joystick' });
      await expect(joystick).toBeInViewport({ ratio: 1 });
      const box = await joystick.boundingBox(); if (!box) throw new Error('Missing joystick');
      // Real pointer capture through the displayed phone control, no store injection.
      await page.mouse.move(box.x + box.width / 2, box.y + box.height * .16);
      await page.mouse.down();
      await expect.poll(z, { timeout: 25000 }).toBeLessThan(12.5);
      await page.mouse.up();
    } else {
      await page.keyboard.down('w');
      await expect.poll(z, { timeout: 25000 }).toBeLessThan(12.5);
      await page.keyboard.up('w');
    }
    await page.getByRole('button', { name: /Backyard warm-up/ }).click();
    await expect(page.getByRole('dialog', { name: 'Backyard warm-up' })).toBeVisible();
    const savedZ = await z();
    await page.screenshot({ path: `test-results/world-offer-${browserName}-${phone ? 'phone' : 'desktop'}.png` });
    await expect(page.getByRole('button', { name: 'START BOUT' })).toBeInViewport({ ratio: 1 });
    await page.getByRole('button', { name: 'START BOUT' }).click();
    await expect(page.locator('.hud')).toHaveAttribute('data-physics-bodies', '32', { timeout: 45000 });
    await expect(page.getByTestId('game-canvas')).toHaveAttribute('data-simulation-ready', 'true');
    await expect(page.getByTestId('game-canvas')).toHaveAttribute('data-combat-venue', 'yard');
    await page.screenshot({ path: `test-results/circuit-yard-${browserName}-${phone ? 'phone' : 'desktop'}.png` });
    if (phone) await page.getByTestId('mobile-controls').getByRole('button', { name: 'Pause match' }).click();
    else await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'RETURN TO SHOWGROUND', exact: true }).click();
    await expect(world).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-game-input-ready', 'true', { timeout: 20000 });
    expect(Math.abs(await z() - savedZ)).toBeLessThan(.5);
    await page.getByRole('button', { name: 'Pause exploration' }).click();
    await page.getByRole('button', { name: 'SAVE & RETURN TO MENU' }).click();
    await page.reload();
    await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
    await page.getByRole('button', { name: 'EXPLORE SHOWGROUND' }).click();
    await page.getByRole('button', { name: 'LOCK IN ATLAS REX' }).click();
    await expect(world).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-game-input-ready', 'true', { timeout: 20000 });
    expect(Math.abs(await z() - savedZ)).toBeLessThan(.5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: /Backyard warm-up/ }).click();
    await expect(page.getByText('Your record:', { exact: false })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test.describe('Connected locations', () => {
  test('walks through the backstage doorway and around the ring to the main-event host', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
    await page.getByRole('button', { name: 'EXPLORE SHOWGROUND' }).click();
    await page.getByRole('button', { name: 'LOCK IN ATLAS REX' }).click();
    const world = page.getByTestId('showground'); await expect(world).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-game-input-ready', 'true', { timeout: 20000 });
    const walk = async (key: string, axis: 'x' | 'z', destination: number, decreasing: boolean) => {
      await page.keyboard.down(key);
      try {
        await expect.poll(async () => {
          const value = Number(await world.getAttribute(`data-world-${axis}`));
          return decreasing ? value <= destination : value >= destination;
        }, { timeout: 45000, intervals: [100] }).toBe(true);
      } finally { await page.keyboard.up(key); }
    };
    await walk('a', 'x', -2, true); await walk('w', 'z', -3, true); await walk('a', 'x', -13, true); await walk('w', 'z', -11, true);
    await expect(world).toHaveAttribute('data-region', 'backstage');
    await page.getByRole('button', { name: /Backstage fight club/ }).click();
    await expect(page.getByRole('dialog', { name: 'Backstage fight club' })).toBeVisible();
    await page.screenshot({ path: `test-results/world-backstage-${browserName}.png` });
    await page.getByRole('button', { name: 'START BOUT' }).click();
    await expect(page.getByTestId('game-canvas')).toHaveAttribute('data-combat-venue', 'backstage');
    await expect(page.getByTestId('game-canvas')).toHaveAttribute('data-simulation-ready', 'true', { timeout: 45000 });
    await page.screenshot({ path: `test-results/circuit-backstage-${browserName}.png` });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'RETURN TO SHOWGROUND', exact: true }).click();
    await expect(world).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-game-input-ready', 'true');
    await walk('s', 'z', -3, false); await walk('d', 'x', 10, false);
    await expect(world).toHaveAttribute('data-region', 'ringside');
    await page.getByRole('button', { name: /The Claw’s open challenge/ }).click();
    await expect(page.getByRole('dialog', { name: 'The Claw’s open challenge' })).toBeVisible();
    await page.getByRole('button', { name: 'KEEP EXPLORING' }).click();
    await page.getByRole('button', { name: 'MAP', exact: true }).click();
    await expect(page.getByRole('complementary', { name: 'Showground map' })).toBeVisible();
    await page.screenshot({ path: `test-results/world-main-event-${browserName}.png` });
  });
});
