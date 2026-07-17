import { expect, test } from '@playwright/test';

test('a body slam visibly lifts, lands torso-first, and settles without a broken body tree', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto('/?physicsLab=1');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: /^STANDARD/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();

  const hud = page.locator('.hud'); const lab = page.getByTestId('physics-lab'); const html = page.locator('html');
  await expect(hud).toHaveAttribute('data-physics-bodies', '32', { timeout: 30_000 });
  const restingPelvisY = Number(await hud.getAttribute('data-opponent-pelvis-y'));
  await page.evaluate(() => {
    const sample = (): void => {
      const liveHud = document.querySelector('.hud'); if (!liveHud) return;
      const pelvisY = Number(liveHud.getAttribute('data-opponent-pelvis-y'));
      const peak = Number(document.documentElement.dataset.slamPeakPelvisY ?? 0);
      if (Number.isFinite(pelvisY) && pelvisY > peak) document.documentElement.dataset.slamPeakPelvisY = pelvisY.toFixed(3);
      if (liveHud.getAttribute('data-grapple-phase') === 'lift') document.documentElement.dataset.sawSlamLift = 'true';
      const contact = liveHud.querySelector('[data-physics-last-contact]')?.getAttribute('data-physics-last-contact');
      if (contact === 'chest>ring') document.documentElement.dataset.sawSlamLanding = 'true';
    };
    new MutationObserver(sample).observe(document.body, { subtree: true, attributes: true, childList: true }); sample();
  });

  const slam = lab.getByRole('button', { name: 'BODY SLAM' }); let completed = false;
  for (let attempt = 0; attempt < 3 && !completed; attempt += 1) {
    await expect(slam).toBeEnabled({ timeout: 30_000 }); await slam.click();
    try {
      await expect.poll(async () => Number(await hud.getAttribute('data-player-grapples')), { timeout: 70_000, intervals: [100, 250, 500] }).toBeGreaterThan(0);
      completed = true;
    } catch {
      // A physical grip may break; retry a bounded number of fresh setups.
    }
  }
  expect(completed).toBe(true);
  await expect(html).toHaveAttribute('data-saw-slam-lift', 'true');
  await expect(html).toHaveAttribute('data-saw-slam-landing', 'true');
  expect(Number(await html.getAttribute('data-slam-peak-pelvis-y'))).toBeGreaterThan(restingPelvisY + .55);
  await expect.poll(async () => Number(await hud.locator('[data-pending-landings]').getAttribute('data-pending-landings')), { timeout: 30_000 }).toBe(0);
  expect(Number(await hud.locator('[data-max-joint-separation]').getAttribute('data-max-joint-separation'))).toBeLessThan(1.35);
  await expect(hud.locator('[data-numerical-faults]')).toHaveAttribute('data-numerical-faults', '0');
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0');
});
