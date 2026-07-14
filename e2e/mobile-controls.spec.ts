import { expect, test } from '@playwright/test';

test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

test('mobile player can enter a match, move, guard, and attack', async ({ page }) => {
  await page.goto('/?physicsLab=1');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();

  const controls = page.getByTestId('mobile-controls'); const hud = page.locator('.hud');
  await expect(controls).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-game-input-ready', 'true', { timeout: 30_000 });
  await expect(hud).toHaveAttribute('data-physics-bodies', '32', { timeout: 30_000 });
  const quick = controls.locator('.mobile-action--quick');
  await expect(quick).toBeVisible(); await expect(quick).toHaveAttribute('data-move-label', 'CIRCUIT JAB');
  await expect(controls.locator('.mobile-action--power')).toHaveAttribute('data-move-label', 'FAULT HOOK');
  await expect(controls.locator('.mobile-action--grapple')).toHaveAttribute('data-move-label', 'LOCK UP');
  await expect(controls.getByRole('button', { name: 'Jump' })).toBeVisible();
  await expect(controls.getByRole('button', { name: 'Pick up, drop, or throw prop' })).toBeVisible();
  await expect(controls.getByRole('button', { name: 'Taunt' })).toBeVisible();

  await page.evaluate(() => {
    const hudNode = document.querySelector('.hud'); if (!hudNode) return;
    const observe = (): void => { if (/jab|combo|high_punch|low_kick/.test(hudNode.getAttribute('data-player-move') ?? '')) document.documentElement.dataset.sawTouchAttack = 'true'; };
    new MutationObserver(observe).observe(hudNode, { attributes: true }); observe();
  });

  const stick = page.getByRole('group', { name: 'Movement joystick' }); const box = await stick.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const intent = hud.locator('[data-player-intent-x]');
  const before = { x: Number(await hud.getAttribute('data-player-x')), z: Number(await hud.getAttribute('data-player-z')) };
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 }; const radius = Math.max(34, Math.min(box.width, box.height) * .38);
  await page.mouse.move(center.x, center.y); await page.mouse.down(); await page.mouse.move(center.x + radius, center.y);
  await expect(page.locator('.context-hint')).toContainText('TOUCH ACTIVE'); await page.waitForTimeout(300);
  const basisX = Number(await intent.getAttribute('data-player-intent-x')); const basisZ = Number(await intent.getAttribute('data-player-intent-z'));
  const basisLength = Math.max(.001, Math.hypot(basisX, basisZ)); const right = { x: basisX / basisLength, z: basisZ / basisLength };
  const aimAtOpponent = async (): Promise<number> => {
    const playerX = Number(await hud.getAttribute('data-player-x')); const playerZ = Number(await hud.getAttribute('data-player-z'));
    const opponentX = Number(await hud.getAttribute('data-opponent-x')); const opponentZ = Number(await hud.getAttribute('data-opponent-z'));
    const dx = opponentX - playerX; const dz = opponentZ - playerZ; const length = Math.max(.001, Math.hypot(dx, dz));
    const rawX = (dx * right.x + dz * right.z) / length; const rawZ = (dx * -right.z + dz * right.x) / length;
    await page.mouse.move(center.x + rawX * radius, center.y + rawZ * radius);
    return length;
  };
  await aimAtOpponent(); await page.waitForTimeout(750);
  const after = { x: Number(await hud.getAttribute('data-player-x')), z: Number(await hud.getAttribute('data-player-z')) };
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(.12);

  await expect.poll(async () => {
    const distance = await aimAtOpponent();
    const state = await hud.getAttribute('data-player-state');
    if (distance < 1.9 && (state === 'idle' || state === 'locomotion')) await quick.dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0 });
    return page.locator('html').getAttribute('data-saw-touch-attack');
  }, { timeout: 15_000, intervals: [120, 180, 240, 320] }).toBe('true');
  await page.mouse.up();
  await expect(page.locator('.context-hint')).toContainText('TOUCH ACTIVE');
  await expect.poll(async () => await hud.getAttribute('data-player-state'), { timeout: 20_000, intervals: [100, 200] }).toMatch(/idle|locomotion/);

  const guard = controls.getByRole('button', { name: 'Hold GUARD' });
  await expect.poll(async () => await hud.getAttribute('data-player-state'), { timeout: 20_000, intervals: [100, 200] }).toMatch(/idle|locomotion/);
  await guard.hover(); await page.mouse.down();
  await expect(guard).toHaveAttribute('aria-pressed', 'true'); await page.mouse.up(); await expect(guard).toHaveAttribute('aria-pressed', 'false');
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(controls).toBeVisible(); await expect(page.getByRole('group', { name: 'Movement joystick' })).toBeVisible();
});
