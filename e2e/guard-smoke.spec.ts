import { expect, test } from '@playwright/test';

test('a raised guard physically intercepts a jab before the torso', async ({ page }) => {
  await page.goto('/?physicsLab=1');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: /^STANDARD/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();
  const hud = page.locator('.hud'); const lab = page.getByTestId('physics-lab'); const root = page.locator('html');
  await expect(hud).toHaveAttribute('data-physics-bodies', '32', { timeout: 30_000 });
  await page.evaluate(() => {
    const sample = (): void => {
      if (document.documentElement.dataset.lastImpactKind === 'blocked') document.documentElement.dataset.sawPhysicalBlock = 'true';
    };
    new MutationObserver(sample).observe(document.documentElement, { attributes: true }); sample();
  });
  await lab.getByRole('button', { name: 'JAB INTO GUARD' }).click();
  await expect(lab).toHaveAttribute('data-lab-scenario', 'idle', { timeout: 12_000 });
  const diagnostics = {
    blocked: await root.getAttribute('data-saw-physical-block'),
    playerHealth: Number(await hud.getAttribute('data-player-health')),
    contact: await hud.locator('[data-physics-last-contact]').getAttribute('data-physics-last-contact'),
    playerLeftHand: await hud.locator('[data-player-left-hand]').getAttribute('data-player-left-hand'),
    playerRightHand: await hud.locator('[data-player-right-hand]').getAttribute('data-player-right-hand'),
    playerRightForearm: await hud.locator('[data-player-right-forearm]').getAttribute('data-player-right-forearm'),
    opponentRightHand: await hud.locator('[data-opponent-right-hand]').getAttribute('data-opponent-right-hand'),
    opponentChest: await hud.locator('[data-opponent-chest]').getAttribute('data-opponent-chest'),
    minimumDistance: Number(await hud.locator('[data-min-strike-distance]').getAttribute('data-min-strike-distance')),
    minimumPlanar: Number(await hud.locator('[data-min-strike-planar-distance]').getAttribute('data-min-strike-planar-distance')),
    minimumVertical: Number(await hud.locator('[data-min-strike-vertical-distance]').getAttribute('data-min-strike-vertical-distance')),
  };
  expect(JSON.stringify(diagnostics)).toContain('"blocked":"true"');
  expect(Number(await hud.getAttribute('data-player-health'))).toBeGreaterThan(99);
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0');
});
