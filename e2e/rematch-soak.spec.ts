import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const enterLabMatch = async (page: Page): Promise<void> => {
  await page.goto('/?physicsLab=1');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: /^STANDARD/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();
};

const usedHeap = async (page: Page): Promise<number> => page.evaluate(() => {
  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  return memory?.usedJSHeapSize ?? 0;
});

test('six bounded instant rematches keep the Rapier world and JS heap stable', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await enterLabMatch(page);

  const hud = page.locator('.hud'); const lab = page.getByTestId('physics-lab');
  await expect(hud).toHaveAttribute('data-physics-bodies', '32', { timeout: 30_000 });
  await expect.poll(async () => Number(await lab.getAttribute('data-lab-fps')), { timeout: 10_000, intervals: [300, 500] }).toBeGreaterThan(0);
  const baselineFps = Number(await lab.getAttribute('data-lab-fps'));
  await page.requestGC(); const baselineHeap = await usedHeap(page); const heaps = [baselineHeap];

  for (let round = 0; round < 6; round += 1) {
    await expect(hud).toHaveAttribute('data-physics-bodies', '32', { timeout: 20_000 });
    await expect(hud).toHaveAttribute('data-physics-joints', '30');
    await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0');
    await expect(hud).toHaveAttribute('data-physics-containments', '0');
    await expect(lab.getByRole('button', { name: 'LAB KNOCKOUT' })).toBeEnabled({ timeout: 8_000 });
    await lab.getByRole('button', { name: 'LAB KNOCKOUT' }).click();
    await expect(page.getByRole('button', { name: 'INSTANT REMATCH' })).toBeVisible({ timeout: 25_000 });
    await page.requestGC(); heaps.push(await usedHeap(page));
    await page.getByRole('button', { name: 'INSTANT REMATCH' }).click();
    await expect(hud).toHaveAttribute('data-physics-bodies', '32', { timeout: 25_000 });
    await expect(hud).toHaveAttribute('data-world-bodies', /3[2-9]|4[0-9]/, { timeout: 10_000 });
  }

  await page.waitForTimeout(1_200);
  await expect.poll(async () => Number(await lab.getAttribute('data-lab-fps')), { timeout: 8_000, intervals: [300, 500] }).toBeGreaterThan(0);
  const finalFps = Number(await lab.getAttribute('data-lab-fps'));
  expect(finalFps).toBeGreaterThanOrEqual(Math.max(1, Math.floor(baselineFps * .45)));
  expect(Number(await lab.getAttribute('data-lab-avg-step-ms'))).toBeLessThan(4);
  expect(Number(await lab.getAttribute('data-lab-p95-step-ms'))).toBeLessThan(7);
  expect(Number(await lab.getAttribute('data-lab-replay-kb'))).toBeLessThan(1_024);
  const heapGrowth = Math.max(...heaps) - baselineHeap;
  if (baselineHeap > 0) expect(heapGrowth).toBeLessThan(Math.max(32 * 1024 * 1024, baselineHeap * .65));
  if (heaps.length > 3 && heaps[1] && heaps.at(-1)) expect((heaps.at(-1) ?? 0) - heaps[1]).toBeLessThan(24 * 1024 * 1024);
  expect(errors).toEqual([]);
});
