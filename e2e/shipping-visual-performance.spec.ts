import { expect, test } from '@playwright/test';

test('shipping Singles presentation remains framed and responsive under live AI combat', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: /^SINGLES/ }).click();
  await page.getByRole('button', { name: /^STANDARD/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();

  const hud = page.locator('.hud'); const canvas = page.getByTestId('game-canvas');
  await expect(hud).toHaveAttribute('data-physics-bodies', '32', { timeout: 30_000 });
  await expect.poll(async () => Number(await hud.getAttribute('data-match-seconds')), { timeout: 60_000 }).toBeGreaterThan(8);
  await page.screenshot({ path: testInfo.outputPath('shipping-singles.png') });
  const metrics = await canvas.evaluate((node) => ({
    tier: node.getAttribute('data-graphics-tier'),
    drawCalls: Number(node.getAttribute('data-draw-calls')),
    triangles: Number(node.getAttribute('data-triangles')),
    geometries: Number(node.getAttribute('data-geometries')),
    frameP95Ms: Number(node.getAttribute('data-frame-p95-ms')),
    frameP99Ms: Number(node.getAttribute('data-frame-p99-ms')),
    framesOver100Ms: Number(node.getAttribute('data-frames-over-100-ms')),
  }));
  await testInfo.attach('shipping-render-metrics.json', { body: JSON.stringify(metrics, null, 2), contentType: 'application/json' });
  console.info('[shipping-render]', JSON.stringify(metrics));
  expect(metrics.drawCalls).toBeGreaterThan(0);
  expect(metrics.geometries).toBeGreaterThan(0);
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0');
  expect(errors).toEqual([]);
});
