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

test('three bounded instant rematches keep the Rapier world and JS heap stable', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await enterLabMatch(page);

  const hud = page.locator('.hud'); const lab = page.getByTestId('physics-lab');
  await expect(hud).toHaveAttribute('data-physics-bodies', '32', { timeout: 30_000 });
  await page.requestGC(); const baselineHeap = await usedHeap(page); const heaps = [baselineHeap];

  for (let round = 0; round < 3; round += 1) {
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
  await expect.poll(async () => Number(await lab.getAttribute('data-lab-fps')), { timeout: 8_000, intervals: [300, 500] }).toBeGreaterThan(20);
  const heapGrowth = Math.max(...heaps) - baselineHeap;
  if (baselineHeap > 0) expect(heapGrowth).toBeLessThan(Math.max(32 * 1024 * 1024, baselineHeap * .65));
  expect(errors).toEqual([]);
});
