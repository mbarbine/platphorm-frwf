import { expect, test } from '@playwright/test';

test('punch, kick, guard, block, and miss remain visually distinct and contact-true', async ({ page }) => {
  test.setTimeout(360_000);
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
      const liveHud = document.querySelector('.hud'); if (!liveHud) return;
      const move = liveHud.getAttribute('data-player-move') ?? '';
      if (move === 'jab') document.documentElement.dataset.sawReadablePunch = 'true';
      if (/kick|roundhouse/.test(move)) document.documentElement.dataset.sawReadableKick = 'true';
      if (liveHud.getAttribute('data-player-state') === 'blocking') document.documentElement.dataset.sawReadableGuard = 'true';
      if (document.documentElement.dataset.lastImpactKind === 'blocked') document.documentElement.dataset.sawPhysicalBlock = 'true';
    };
    new MutationObserver(sample).observe(document.body, { subtree: true, attributes: true, childList: true }); sample();
  });

  await lab.getByRole('button', { name: 'CONTACT-TRUE JAB' }).click();
  await expect(root).toHaveAttribute('data-saw-readable-punch', 'true');
  await expect.poll(async () => Number(await hud.getAttribute('data-opponent-health')), { timeout: 8_000 }).toBeLessThan(100);

  await expect(lab.getByRole('button', { name: 'DIRECTIONAL KICK' })).toBeEnabled({ timeout: 5_000 });
  await lab.getByRole('button', { name: 'DIRECTIONAL KICK' }).click();
  await expect(root).toHaveAttribute('data-saw-readable-kick', 'true');
  await expect.poll(async () => Number(await hud.getAttribute('data-opponent-health')), { timeout: 8_000 }).toBeLessThan(100);

  await expect(lab.getByRole('button', { name: 'BLOCK WINDOW' })).toBeEnabled({ timeout: 5_000 });
  await lab.getByRole('button', { name: 'BLOCK WINDOW' }).click();
  await expect(root).toHaveAttribute('data-saw-readable-guard', 'true');

  await expect(lab.getByRole('button', { name: 'JAB INTO GUARD' })).toBeEnabled({ timeout: 5_000 });
  await lab.getByRole('button', { name: 'JAB INTO GUARD' }).click();
  await expect(root).toHaveAttribute('data-saw-physical-block', 'true', { timeout: 90_000 });

  await expect(lab.getByRole('button', { name: 'MISSED KICK' })).toBeEnabled({ timeout: 5_000 });
  await lab.getByRole('button', { name: 'MISSED KICK' }).click();
  await expect(lab).toHaveAttribute('data-lab-scenario', 'idle', { timeout: 8_000 });
  expect(Number(await hud.getAttribute('data-opponent-health'))).toBe(100);
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0');
});
