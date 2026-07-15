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

  const hud = page.locator('.hud'); const lab = page.getByTestId('physics-lab'); const deck = page.getByTestId('control-deck'); const telemetry = hud.locator('[data-player-climb-stage]'); const momentum = hud.locator('[data-player-momentum]');
  await expect(hud).toHaveAttribute('data-physics-bodies', '32', { timeout: 60_000 });
  const slam = lab.getByRole('button', { name: 'BODY SLAM' });
  await page.evaluate(() => {
    const observe = (): void => {
      const grapple = document.querySelector('[data-testid="control-deck"] [data-control="grapple"]');
      if (grapple?.classList.contains('is-active')) document.documentElement.dataset.sawActiveGrappleControl = 'true';
    };
    new MutationObserver(observe).observe(document.body, { subtree: true, attributes: true }); observe();
  });
  let completedPhysicalSlam = false;
  for (let attempt = 0; attempt < 3 && !completedPhysicalSlam; attempt += 1) {
    const startingGripCreates = Number(await hud.getAttribute('data-grip-creates'));
    await expect(slam).toBeEnabled({ timeout: 60_000 }); await slam.click();
    if (attempt === 0) {
      await expect.poll(async () => await deck.getAttribute('data-control-state'), { timeout: 60_000, intervals: [50, 100, 500] }).toMatch(/SLAM|GRAPPLE/);
      await expect(page.locator('html')).toHaveAttribute('data-saw-active-grapple-control', 'true', { timeout: 60_000 });
    }
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
  await expect(deck.locator('[data-control="taunt"]')).toHaveClass(/is-active/);
  for (const move of ['NEON DROP ELBOW', 'TOP-ROPE MISSILE KICK', 'DOMEFALL DIVE', 'CLIMB DOWN']) await expect(deck).toContainText(move);
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
