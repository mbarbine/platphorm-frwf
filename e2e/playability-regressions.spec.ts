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

test('deterministic playability scenarios cover stability, rope stiff-arm, corner dive, apron return, and table collapse', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await enterLabMatch(page);

  const hud = page.locator('.hud'); const lab = page.getByTestId('physics-lab'); const html = page.locator('html');
  await page.waitForTimeout(1_400);
  const idleSamples: { x: number; z: number; pelvis: number; head: number }[] = [];
  for (let sample = 0; sample < 20; sample += 1) {
    idleSamples.push({
      x: Number(await hud.getAttribute('data-player-x')), z: Number(await hud.getAttribute('data-player-z')),
      pelvis: Number(await hud.getAttribute('data-player-pelvis-y')), head: Number(await hud.getAttribute('data-player-head-y')),
    });
    await page.waitForTimeout(100);
  }
  const range = (values: number[]): number => Math.max(...values) - Math.min(...values);
  expect(range(idleSamples.map(({ x }) => x))).toBeLessThan(.09);
  expect(range(idleSamples.map(({ z }) => z))).toBeLessThan(.09);
  expect(range(idleSamples.map(({ pelvis }) => pelvis))).toBeLessThan(.12);
  expect(range(idleSamples.map(({ head, pelvis }) => head - pelvis))).toBeLessThan(.14);

  await page.evaluate(() => {
    const observe = (): void => {
      const liveHud = document.querySelector('.hud'); const deck = document.querySelector('[data-testid="control-deck"]');
      if (liveHud?.getAttribute('data-player-move') === 'stiff_arm') document.documentElement.dataset.sawDeterministicStiffArm = 'true';
      if (/downed|airborne/.test(liveHud?.getAttribute('data-opponent-state') ?? '')) document.documentElement.dataset.sawDeterministicKnockdown = 'true';
      if (deck?.textContent?.includes('STIFF-ARM!') || deck?.textContent?.includes('ROPES LOADED')) document.documentElement.dataset.sawDeterministicRopeLoad = 'true';
    };
    new MutationObserver(observe).observe(document.body, { subtree: true, attributes: true, childList: true }); observe();
  });
  const rope = lab.getByRole('button', { name: 'ROPE LOAD + STIFF-ARM' }); await rope.click();
  await expect(html).toHaveAttribute('data-saw-deterministic-rope-load', 'true', { timeout: 5_000 });
  await expect(html).toHaveAttribute('data-saw-deterministic-stiff-arm', 'true', { timeout: 5_000 });
  await expect(html).toHaveAttribute('data-saw-deterministic-knockdown', 'true', { timeout: 6_000 });

  await expect(lab.getByRole('button', { name: 'TOP-ROPE DIVE' })).toBeEnabled({ timeout: 5_000 });
  const healthBeforeDive = Number(await hud.getAttribute('data-opponent-health'));
  await page.evaluate((startingHealth) => {
    const observe = (): void => {
      const liveHud = document.querySelector('.hud');
      if (/aerial/.test(liveHud?.getAttribute('data-player-move') ?? '')) document.documentElement.dataset.sawDeterministicDive = 'true';
      if (Number(liveHud?.getAttribute('data-opponent-health')) < startingHealth) document.documentElement.dataset.sawDeterministicDiveImpact = 'true';
      const playerX = Number(liveHud?.getAttribute('data-player-x')); const playerZ = Number(liveHud?.getAttribute('data-player-z'));
      const opponentX = Number(liveHud?.getAttribute('data-opponent-x')); const opponentZ = Number(liveHud?.getAttribute('data-opponent-z'));
      const distance = Math.hypot(playerX - opponentX, playerZ - opponentZ); const previous = Number(document.documentElement.dataset.diveMinimumDistance ?? Number.POSITIVE_INFINITY);
      if (Number.isFinite(distance) && distance < previous) {
        document.documentElement.dataset.diveMinimumDistance = distance.toFixed(3);
        document.documentElement.dataset.diveMinimumPhase = liveHud?.getAttribute('data-player-phase') ?? '';
        document.documentElement.dataset.diveMinimumMove = liveHud?.getAttribute('data-player-move') ?? '';
      }
    };
    new MutationObserver(observe).observe(document.body, { subtree: true, attributes: true, childList: true }); observe();
  }, healthBeforeDive);
  await lab.getByRole('button', { name: 'TOP-ROPE DIVE' }).click();
  await expect(html).toHaveAttribute('data-saw-deterministic-dive', 'true', { timeout: 8_000 });
  await expect.poll(async () => Number(await html.getAttribute('data-dive-minimum-distance')), { timeout: 10_000, intervals: [100, 200] }).toBeLessThan(2.4);
  await expect(html).toHaveAttribute('data-saw-deterministic-dive-impact', 'true', { timeout: 10_000 });

  const apron = lab.getByRole('button', { name: 'APRON RETURN' }); await expect(apron).toBeEnabled({ timeout: 6_000 }); await apron.click();
  await expect(hud).toHaveAttribute('data-player-ringside', 'true', { timeout: 2_000 });
  await expect(hud).toHaveAttribute('data-player-ringside', 'false', { timeout: 6_000 });
  await expect.poll(async () => Math.abs(Number(await hud.getAttribute('data-player-x'))), { timeout: 6_000, intervals: [100, 200] }).toBeLessThan(5.3);

  const table = lab.getByRole('button', { name: 'TABLE COLLAPSE' }); await expect(table).toBeEnabled({ timeout: 6_000 }); await table.click();
  await expect(hud.locator('[data-table-stage]')).toHaveAttribute('data-table-stage', 'failed', { timeout: 15_000 });
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0');
  expect(errors).toEqual([]);
});
