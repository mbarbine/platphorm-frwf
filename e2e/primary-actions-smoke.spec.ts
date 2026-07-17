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
    const vector = (value: string | null): [number, number, number] | null => {
      const parsed = value?.split(',').map(Number);
      return parsed?.length === 3 && parsed.every(Number.isFinite)
        ? [parsed[0] ?? 0, parsed[1] ?? 0, parsed[2] ?? 0]
        : null;
    };
    const sample = (): void => {
      const liveHud = document.querySelector('.hud'); if (!liveHud) return;
      const move = liveHud.getAttribute('data-player-move') ?? '';
      if (move === 'jab') {
        document.documentElement.dataset.sawReadablePunch = 'true';
        const chest = vector(liveHud.querySelector('[data-player-chest]')?.getAttribute('data-player-chest') ?? null);
        const hand = vector(liveHud.querySelector('[data-player-right-hand]')?.getAttribute('data-player-right-hand') ?? null);
        if (chest && hand) {
          const reach = Math.hypot(hand[0] - chest[0], hand[1] - chest[1], hand[2] - chest[2]);
          const maximum = Number(document.documentElement.dataset.maximumPunchReach ?? 0);
          if (reach > maximum) document.documentElement.dataset.maximumPunchReach = reach.toFixed(3);
        }
      }
      if (/kick|roundhouse/.test(move)) document.documentElement.dataset.sawReadableKick = 'true';
      if (liveHud.getAttribute('data-player-state') === 'blocking') document.documentElement.dataset.sawReadableGuard = 'true';
      if (document.documentElement.dataset.lastImpactKind === 'blocked') document.documentElement.dataset.sawPhysicalBlock = 'true';
    };
    new MutationObserver(sample).observe(document.body, { subtree: true, attributes: true, childList: true }); sample();
    new MutationObserver(() => {
      if (document.documentElement.dataset.lastImpactKind === 'blocked') document.documentElement.dataset.sawPhysicalBlock = 'true';
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-last-impact-kind'] });
  });

  await lab.getByRole('button', { name: 'CONTACT-TRUE JAB' }).click();
  await expect(root).toHaveAttribute('data-saw-readable-punch', 'true');
  await expect.poll(async () => Number(await root.getAttribute('data-maximum-punch-reach')), { timeout: 8_000 }).toBeGreaterThan(.75);
  await expect.poll(async () => Number(await hud.getAttribute('data-opponent-health')), { timeout: 8_000 }).toBeLessThan(100);
  expect(await hud.getAttribute('data-opponent-state')).not.toMatch(/downed|airborne/);
  expect(Number(await hud.getAttribute('data-opponent-pelvis-y'))).toBeGreaterThan(1.86);

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

test('down plus strike performs a visible contact-true headbutt', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/?physicsLab=1');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: /^STANDARD/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();
  const hud = page.locator('.hud'); const lab = page.getByTestId('physics-lab'); const root = page.locator('html');
  await expect(hud).toHaveAttribute('data-physics-bodies', '32', { timeout: 30_000 });
  await page.evaluate(() => {
    const vector = (value: string | null): [number, number, number] | null => {
      const parsed = value?.split(',').map(Number);
      return parsed?.length === 3 && parsed.every(Number.isFinite) ? [parsed[0] ?? 0, parsed[1] ?? 0, parsed[2] ?? 0] : null;
    };
    const sample = (): void => {
      const liveHud = document.querySelector('.hud'); if (!liveHud) return;
      if (liveHud.getAttribute('data-player-move') !== 'headbutt') return;
      document.documentElement.dataset.sawHeadbuttMotion = 'true';
      const player = vector(liveHud.querySelector('[data-player-head]')?.getAttribute('data-player-head') ?? null);
      const opponent = vector(liveHud.querySelector('[data-opponent-head]')?.getAttribute('data-opponent-head') ?? null);
      if (player && opponent) {
        const distance = Math.hypot(player[0] - opponent[0], player[1] - opponent[1], player[2] - opponent[2]);
        const minimum = Number(document.documentElement.dataset.minimumHeadbuttDistance ?? Number.POSITIVE_INFINITY);
        if (distance < minimum) document.documentElement.dataset.minimumHeadbuttDistance = distance.toFixed(3);
      }
      const contact = liveHud.querySelector('[data-physics-last-contact]')?.getAttribute('data-physics-last-contact') ?? '';
      if (contact.startsWith('head>')) document.documentElement.dataset.sawHeadbuttContact = 'true';
    };
    new MutationObserver(sample).observe(document.body, { subtree: true, attributes: true, childList: true }); sample();
  });
  await lab.getByRole('button', { name: 'CONTACT-TRUE HEADBUTT' }).click();
  await expect(root).toHaveAttribute('data-saw-headbutt-motion', 'true', { timeout: 8_000 });
  // Head colliders are capsules, so their solved surface contact occurs while
  // the body centers are still roughly half a metre apart.
  await expect.poll(async () => Number(await root.getAttribute('data-minimum-headbutt-distance')), { timeout: 10_000, intervals: [80, 160, 320] }).toBeLessThan(.62);
  await expect(root).toHaveAttribute('data-saw-headbutt-contact', 'true', { timeout: 15_000 });
  await expect.poll(async () => Number(await hud.getAttribute('data-opponent-health')), { timeout: 15_000, intervals: [80, 160, 320] }).toBeLessThan(100);
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0');
});
