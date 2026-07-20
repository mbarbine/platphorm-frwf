import { expect, test } from '@playwright/test';

test('a raised guard physically intercepts a jab before the torso', async ({ page }) => {
  test.setTimeout(240_000);
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
      const contact = document.querySelector('.hud [data-physics-last-contact]')?.getAttribute('data-physics-last-contact') ?? '';
      if (/>(?:left|right)(?:Hand|Forearm)$/.test(contact)) {
        document.documentElement.dataset.sawGuardContact = 'true';
        const raw = document.querySelector('.hud [data-physics-last-contact-force]');
        document.documentElement.dataset.guardContactForce = raw?.getAttribute('data-physics-last-contact-force') ?? '0';
        document.documentElement.dataset.guardContactSpeed = raw?.getAttribute('data-physics-last-contact-speed') ?? '0';
      }
    };
    // Observe shipping HUD mutations, not the <html> evidence attributes this
    // sampler writes. Watching <html> made a successful contact recursively
    // trigger its own observer until a throttled browser became unresponsive.
    new MutationObserver(sample).observe(document.body, { attributes: true, subtree: true, childList: true }); sample();
  });
  await lab.getByRole('button', { name: 'JAB INTO GUARD' }).click();
  await expect(root).toHaveAttribute('data-lab-blocked-jab-diagnostics', /.+/, { timeout: 75_000 });
  const setupDiagnostics = await root.getAttribute('data-lab-blocked-jab-diagnostics');
  await expect(root, setupDiagnostics ?? 'blocked-jab diagnostics unavailable').toHaveAttribute('data-lab-blocked-jab-accepted', 'true', { timeout: 75_000 });
  await expect(root).toHaveAttribute('data-saw-guard-contact', 'true', { timeout: 90_000 });
  await expect(lab).toHaveAttribute('data-lab-scenario', 'idle', { timeout: 90_000 });
  const diagnostics = {
    accepted: await root.getAttribute('data-lab-blocked-jab-accepted'),
    blocked: await root.getAttribute('data-saw-physical-block'),
    guardContact: await root.getAttribute('data-saw-guard-contact'),
    guardContactForce: Number(await root.getAttribute('data-guard-contact-force')),
    guardContactSpeed: Number(await root.getAttribute('data-guard-contact-speed')),
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
  expect(diagnostics.accepted, JSON.stringify(diagnostics)).toBe('true');
  expect(diagnostics.blocked, JSON.stringify(diagnostics)).toBe('true');
  expect(diagnostics.guardContact, JSON.stringify(diagnostics)).toBe('true');
  expect(diagnostics.guardContactSpeed >= .28 || diagnostics.guardContactForce >= 45, JSON.stringify(diagnostics)).toBe(true);
  expect(diagnostics.playerHealth, JSON.stringify(diagnostics)).toBeLessThan(100);
  expect(Number(await hud.getAttribute('data-player-health'))).toBeGreaterThan(98);
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0');
});
