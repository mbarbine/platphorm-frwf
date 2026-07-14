import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const enterLabMatch = async (page: Page): Promise<void> => {
  await page.goto('/?physicsLab=1');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: /^STANDARD/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();
  await expect(page.locator('.hud')).toHaveAttribute('data-physics-bodies', '32', { timeout: 30_000 });
};

const captureErrors = (page: Page): string[] => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
};

test('standing articulated wrestlers remain visually stable at idle', async ({ page }) => {
  const errors = captureErrors(page); await enterLabMatch(page);
  const hud = page.locator('.hud'); await page.waitForTimeout(1_400);
  const samples: { x: number; z: number; pelvis: number; head: number }[] = [];
  for (let sample = 0; sample < 20; sample += 1) {
    samples.push({
      x: Number(await hud.getAttribute('data-player-x')), z: Number(await hud.getAttribute('data-player-z')),
      pelvis: Number(await hud.getAttribute('data-player-pelvis-y')), head: Number(await hud.getAttribute('data-player-head-y')),
    });
    await page.waitForTimeout(100);
  }
  const range = (values: number[]): number => Math.max(...values) - Math.min(...values);
  expect(range(samples.map(({ x }) => x))).toBeLessThan(.09);
  expect(range(samples.map(({ z }) => z))).toBeLessThan(.09);
  expect(range(samples.map(({ pelvis }) => pelvis))).toBeLessThan(.12);
  expect(range(samples.map(({ head, pelvis }) => head - pelvis))).toBeLessThan(.14);
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0'); expect(errors).toEqual([]);
});

test('rope rebound produces a loaded stiff-arm and physical knockdown', async ({ page }) => {
  const errors = captureErrors(page); await enterLabMatch(page);
  const hud = page.locator('.hud'); const lab = page.getByTestId('physics-lab'); const html = page.locator('html');
  await page.evaluate(() => {
    const observe = (): void => {
      const liveHud = document.querySelector('.hud'); const deck = document.querySelector('[data-testid="control-deck"]');
      if (liveHud?.getAttribute('data-player-move') === 'stiff_arm') document.documentElement.dataset.sawDeterministicStiffArm = 'true';
      if (/downed|airborne/.test(liveHud?.getAttribute('data-opponent-state') ?? '')) document.documentElement.dataset.sawDeterministicKnockdown = 'true';
      if (deck?.textContent?.includes('STIFF-ARM!') || deck?.textContent?.includes('ROPES LOADED')) document.documentElement.dataset.sawDeterministicRopeLoad = 'true';
    };
    new MutationObserver(observe).observe(document.body, { subtree: true, attributes: true, childList: true }); observe();
  });
  await lab.getByRole('button', { name: 'ROPE LOAD + STIFF-ARM' }).click();
  await expect(html).toHaveAttribute('data-saw-deterministic-rope-load', 'true', { timeout: 6_000 });
  await expect(html).toHaveAttribute('data-saw-deterministic-stiff-arm', 'true', { timeout: 6_000 });
  await expect(html).toHaveAttribute('data-saw-deterministic-knockdown', 'true', { timeout: 8_000 });
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0'); expect(errors).toEqual([]);
});

test('top-rope dive tracks the target and lands physical damage', async ({ page }) => {
  const errors = captureErrors(page); await enterLabMatch(page);
  const hud = page.locator('.hud'); const lab = page.getByTestId('physics-lab'); const html = page.locator('html'); const startingHealth = Number(await hud.getAttribute('data-opponent-health'));
  await page.evaluate((health) => {
    const observe = (): void => {
      const liveHud = document.querySelector('.hud'); const aerial = /aerial/.test(liveHud?.getAttribute('data-player-move') ?? '');
      if (aerial) document.documentElement.dataset.sawDeterministicDive = 'true';
      if (Number(liveHud?.getAttribute('data-opponent-health')) < health) document.documentElement.dataset.sawDeterministicDiveImpact = 'true';
      if (!aerial) return;
      const playerX = Number(liveHud?.getAttribute('data-player-x')); const playerZ = Number(liveHud?.getAttribute('data-player-z'));
      const opponentX = Number(liveHud?.getAttribute('data-opponent-x')); const opponentZ = Number(liveHud?.getAttribute('data-opponent-z'));
      const distance = Math.hypot(playerX - opponentX, playerZ - opponentZ); const previous = Number(document.documentElement.dataset.diveMinimumDistance ?? Number.POSITIVE_INFINITY);
      if (Number.isFinite(distance) && distance < previous) document.documentElement.dataset.diveMinimumDistance = distance.toFixed(3);
    };
    new MutationObserver(observe).observe(document.body, { subtree: true, attributes: true, childList: true }); observe();
  }, startingHealth);
  await lab.getByRole('button', { name: 'TOP-ROPE DIVE' }).click();
  await expect(html).toHaveAttribute('data-saw-deterministic-dive', 'true', { timeout: 8_000 });
  await expect.poll(async () => Number(await html.getAttribute('data-dive-minimum-distance')), { timeout: 10_000, intervals: [100, 200] }).toBeLessThan(2.4);
  await expect(html).toHaveAttribute('data-saw-deterministic-dive-impact', 'true', { timeout: 10_000 });
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0'); expect(errors).toEqual([]);
});

test('ringside wrestler returns through the apron without crossing a wall', async ({ page }) => {
  const errors = captureErrors(page); await enterLabMatch(page);
  const hud = page.locator('.hud'); const lab = page.getByTestId('physics-lab');
  await lab.getByRole('button', { name: 'APRON RETURN' }).click();
  await expect(hud).toHaveAttribute('data-player-ringside', 'true', { timeout: 2_000 });
  await expect(hud).toHaveAttribute('data-player-ringside', 'false', { timeout: 6_000 });
  await expect.poll(async () => Math.abs(Number(await hud.getAttribute('data-player-x'))), { timeout: 6_000, intervals: [100, 200] }).toBeLessThan(5.3);
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0'); expect(errors).toEqual([]);
});

test('physical body slam collapses the commentary table', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = captureErrors(page); await enterLabMatch(page);
  const hud = page.locator('.hud'); const lab = page.getByTestId('physics-lab');
  await lab.getByRole('button', { name: 'TABLE COLLAPSE' }).click();
  await expect(hud.locator('[data-table-stage]')).toHaveAttribute('data-table-stage', 'failed', { timeout: 20_000 });
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0'); expect(errors).toEqual([]);
});
