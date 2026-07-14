import { expect, test } from '@playwright/test';

const requestedDuration = Number(process.env.BODYWORKS_SOAK_MS ?? 300_000);
const soakDurationMs = Math.max(60_000, Math.min(300_000, Number.isFinite(requestedDuration) ? requestedDuration : 300_000));

test('bounded five-minute rematch and heap soak', async ({ page }, testInfo) => {
  test.skip(process.env.RUN_LONG_SOAK !== 'true', 'Run explicitly with pnpm test:soak:5m.');
  test.setTimeout(soakDurationMs + 90_000);
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?physicsLab=1');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: /^STANDARD/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();

  const hud = page.locator('.hud'); const lab = page.getByTestId('physics-lab');
  await expect(hud).toHaveAttribute('data-physics-bodies', '32', { timeout: 30_000 });
  const heapSamples: number[] = []; const physicsSamples: number[] = []; const startedAt = Date.now(); let rematches = 0;
  const sample = async (): Promise<void> => {
    await page.requestGC();
    heapSamples.push(await page.evaluate(() => (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0));
    physicsSamples.push(Number(await lab.getAttribute('data-lab-p95-step-ms')));
  };
  await sample();

  while (Date.now() - startedAt < soakDurationMs) {
    await expect(lab.getByRole('button', { name: 'LAB KNOCKOUT' })).toBeEnabled({ timeout: 12_000 });
    await lab.getByRole('button', { name: 'LAB KNOCKOUT' }).click();
    await expect(page.getByRole('button', { name: 'INSTANT REMATCH' })).toBeVisible({ timeout: 30_000 });
    await sample(); rematches += 1;
    await page.getByRole('button', { name: 'INSTANT REMATCH' }).click();
    await expect(hud).toHaveAttribute('data-physics-bodies', '32', { timeout: 30_000 });
    await expect(hud).toHaveAttribute('data-physics-joints', '30');
    await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0');
    await expect(hud).toHaveAttribute('data-invalid-bodies', '0');
  }

  const nonZeroHeap = heapSamples.filter((value) => value > 0); const baselineHeap = nonZeroHeap[0] ?? 0;
  const maximumHeap = nonZeroHeap.length > 0 ? Math.max(...nonZeroHeap) : 0; const heapGrowth = Math.max(0, maximumHeap - baselineHeap);
  const artifact = {
    durationMs: Date.now() - startedAt, rematches, heapSamples, baselineHeap, maximumHeap, heapGrowth,
    p95StepSamples: physicsSamples, finalBodies: Number(await hud.getAttribute('data-physics-bodies')),
    finalJoints: Number(await hud.getAttribute('data-physics-joints')), emergencyResets: Number(await hud.getAttribute('data-physics-emergency-resets')),
    numericalFaults: Number(await hud.locator('span[hidden]').first().getAttribute('data-numerical-faults')), errors,
  };
  await testInfo.attach('five-minute-soak.json', { body: JSON.stringify(artifact, null, 2), contentType: 'application/json' });
  expect(rematches).toBeGreaterThan(0); expect(artifact.finalBodies).toBe(32); expect(artifact.finalJoints).toBe(30);
  expect(artifact.emergencyResets).toBe(0); expect(artifact.numericalFaults).toBe(0); expect(Math.max(...physicsSamples)).toBeLessThan(12);
  if (baselineHeap > 0) expect(heapGrowth).toBeLessThan(Math.max(48 * 1024 * 1024, baselineHeap * .8));
  expect(errors).toEqual([]);
});
