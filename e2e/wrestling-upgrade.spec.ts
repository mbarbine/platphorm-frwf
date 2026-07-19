import { expect, test } from '@playwright/test';

test('controlled Bodyworks scenarios prove a physical slam, staged climb, taunt, and top-rope dive', async ({ page }) => {
  test.setTimeout(900_000);
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?physicsLab=1');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: /^STANDARD/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();

  const hud = page.locator('.hud'); const lab = page.getByTestId('physics-lab'); const telemetry = hud.locator('[data-player-climb-stage]'); const momentum = hud.locator('[data-player-momentum]');
  await expect(hud).toHaveAttribute('data-physics-bodies', '32', { timeout: 60_000 });
  const slam = lab.getByRole('button', { name: 'BODY SLAM' });
  await page.evaluate(() => {
    const observe = (): void => {
      const liveHud = document.querySelector('.hud');
      const grapple = document.querySelector('[data-testid="control-deck"] [data-control="grapple"]');
      if (grapple?.classList.contains('is-active') || liveHud?.getAttribute('data-player-state') === 'grappling') document.documentElement.dataset.sawActiveGrappleControl = 'true';
      const pelvisY = Number(liveHud?.getAttribute('data-opponent-pelvis-y'));
      if (Number.isFinite(pelvisY)) {
        const peak = Number(document.documentElement.dataset.slamPeakPelvisY ?? 0);
        if (pelvisY > peak) document.documentElement.dataset.slamPeakPelvisY = pelvisY.toFixed(3);
      }
      if (liveHud?.getAttribute('data-grapple-phase') === 'lift') document.documentElement.dataset.sawAirborneSlamLift = 'true';
      if (liveHud?.querySelector('[data-physics-last-contact]')?.getAttribute('data-physics-last-contact') === 'chest>ring') document.documentElement.dataset.sawTorsoMatSlam = 'true';
    };
    new MutationObserver(observe).observe(document.body, { subtree: true, attributes: true }); observe();
  });
  let completedPhysicalSlam = false;
  const restingOpponentPelvisY = Number(await hud.getAttribute('data-opponent-pelvis-y'));
  for (let attempt = 0; attempt < 3 && !completedPhysicalSlam; attempt += 1) {
    const startingGripCreates = Number(await hud.getAttribute('data-grip-creates'));
    await expect(slam).toBeEnabled({ timeout: 60_000 }); await slam.click();
    if (attempt === 0) await expect(page.locator('html')).toHaveAttribute('data-saw-active-grapple-control', 'true', { timeout: 60_000 });
    await expect.poll(async () => Number(await hud.getAttribute('data-grip-creates')), { timeout: 60_000, intervals: [100, 200, 500] }).toBeGreaterThanOrEqual(startingGripCreates + 2);
    try {
      await expect.poll(async () => Number(await hud.getAttribute('data-player-grapples')), { timeout: 60_000, intervals: [200, 400, 1_000] }).toBeGreaterThan(0);
      completedPhysicalSlam = true;
    } catch {
      // A live articulated grip can break before the follow-up impact. Retry a
      // bounded number of real input attempts instead of fabricating success.
    }
  }
  expect(completedPhysicalSlam).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('data-saw-airborne-slam-lift', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-saw-torso-mat-slam', 'true');
  expect(Number(await page.locator('html').getAttribute('data-slam-peak-pelvis-y'))).toBeGreaterThan(restingOpponentPelvisY + .55);
  await expect(hud.locator('[data-numerical-faults]')).toHaveAttribute('data-numerical-faults', '0');
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0');
  const replay = page.getByRole('button', { name: 'SKIP REPLAY' });
  if (await replay.isVisible()) await replay.click();

  const climb = lab.getByRole('button', { name: 'CLIMB + TAUNT' });
  await page.evaluate(() => {
    const observe = (): void => {
      const liveHud = document.querySelector('.hud');
      if (liveHud?.getAttribute('data-player-move') === 'taunt') document.documentElement.dataset.sawStagedTaunt = 'true';
    };
    new MutationObserver(observe).observe(document.body, { subtree: true, attributes: true, childList: true }); observe();
  });
  await expect(climb).toBeEnabled({ timeout: 60_000 }); await climb.click();
  await expect.poll(async () => Number(await telemetry.getAttribute('data-player-climb-stage')), { timeout: 240_000, intervals: [100, 200, 400, 1_000] }).toBe(3);
  await expect(page.locator('html')).toHaveAttribute('data-saw-staged-taunt', 'true', { timeout: 240_000 });
  const liveHint = page.locator('.context-hint');
  for (const move of ['ELBOW', 'MISSILE KICK', 'DOMEFALL', 'POSE']) await expect(liveHint).toContainText(move);
  await page.screenshot({ path: '/tmp/frwf-wrestling-upgrade.png' });
  await expect.poll(async () => Number(await momentum.getAttribute('data-player-momentum')), { timeout: 240_000, intervals: [200, 400, 1_000] }).toBeGreaterThan(0);

  const dive = lab.getByRole('button', { name: 'TOP-ROPE DIVE' });
  await page.evaluate(() => {
    const observe = (): void => {
      const liveHud = document.querySelector('.hud');
      if (liveHud?.getAttribute('data-player-move') === 'aerial') document.documentElement.dataset.sawStagedAerial = 'true';
    };
    new MutationObserver(observe).observe(document.body, { subtree: true, attributes: true, childList: true }); observe();
  });
  await expect(dive).toBeEnabled({ timeout: 60_000 }); await dive.click();
  await expect(page.locator('html')).toHaveAttribute('data-saw-staged-aerial', 'true', { timeout: 240_000 });
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0', { timeout: 60_000 });
  expect(errors).toEqual([]);
});
