import { expect, test } from '@playwright/test';

test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

test('mobile player can enter a match, move, guard, and attack', async ({ page }) => {
  test.setTimeout(300_000);
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
  const grapple = controls.locator('.mobile-action--grapple');
  await expect(quick).toBeVisible(); await expect(quick).toHaveAttribute('data-move-label', 'CIRCUIT JAB');
  await expect(controls.locator('.mobile-action--power')).toHaveAttribute('data-move-label', 'PISTON BOOT');
  await expect(grapple).toHaveAttribute('data-move-label', 'CLOSE DISTANCE'); await expect(grapple).toBeDisabled();
  await expect(controls.getByRole('button', { name: 'Jump' })).toBeVisible();
  await expect(controls.getByRole('button', { name: 'Pick up, drop, or throw prop' })).toBeVisible();
  await expect(controls.getByRole('button', { name: 'Taunt' })).toBeVisible();

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
  await page.mouse.up();

  // Movement is proven above. Put both articulated bodies into a known legal
  // strike context before proving that the independent touch edge reaches the
  // authoritative action buffer.
  const rangeSetup = page.getByTestId('physics-lab').getByRole('button', { name: 'CLOSE-RANGE INPUT' });
  await rangeSetup.click(); await expect(rangeSetup).toBeEnabled({ timeout: 30_000 });
  await expect.poll(async () => hud.getAttribute('data-player-state'), { timeout: 20_000, intervals: [100, 200] }).toMatch(/idle|locomotion/);
  await expect(grapple).toHaveAttribute('data-move-label', 'COLLAR LOCK'); await expect(grapple).toBeEnabled();
  await quick.dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0 });
  await expect(hud.locator('[data-last-action]')).toHaveAttribute('data-last-action', 'quickStrike', { timeout: 15_000 });
  await expect(hud.locator('[data-last-action]')).toHaveAttribute('data-last-action-source', 'touch', { timeout: 15_000 });
  await expect(hud.locator('[data-last-action]')).toHaveAttribute('data-last-action-status', 'executed', { timeout: 15_000 });
  await quick.dispatchEvent('pointerup', { pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0 });
  await expect(page.locator('.context-hint')).toContainText('TOUCH ACTIVE');
  await expect.poll(async () => await hud.getAttribute('data-player-state'), { timeout: 20_000, intervals: [100, 200] }).toMatch(/idle|locomotion/);

  const guard = controls.getByRole('button', { name: 'Hold GUARD' });
  await expect.poll(async () => await hud.getAttribute('data-player-state'), { timeout: 20_000, intervals: [100, 200] }).toMatch(/idle|locomotion/);
  await guard.hover(); await page.mouse.down();
  await expect(guard).toHaveAttribute('aria-pressed', 'true'); await page.mouse.up(); await expect(guard).toHaveAttribute('aria-pressed', 'false');

  await page.setViewportSize({ width: 844, height: 390 });
  await expect(controls).toBeVisible(); await expect(page.getByRole('group', { name: 'Movement joystick' })).toBeVisible();
});

test('paused touch controls cannot queue a stale wrestling action', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('/?physicsLab=1');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();

  const controls = page.getByTestId('mobile-controls'); const hud = page.locator('.hud'); const canvas = page.locator('.game-canvas canvas');
  const pause = controls.getByRole('button', { name: 'Pause match' }); const quick = controls.locator('.mobile-action--quick');
  await expect(hud).toHaveAttribute('data-physics-bodies', '32', { timeout: 30_000 });
  expect(await canvas.evaluate((element) => getComputedStyle(element).pointerEvents)).toBe('none');
  const hitTarget = async (): Promise<string | null> => pause.evaluate((button) => {
    const bounds = button.getBoundingClientRect();
    return document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)?.getAttribute('aria-label') ?? null;
  });
  expect(await hitTarget()).toBe('Pause match');

  const executedBeforePause = Number(await hud.locator('[data-action-executed]').getAttribute('data-action-executed'));
  await pause.click({ timeout: 5_000 });
  await expect(page.locator('.pause-overlay')).toBeVisible();
  await expect(quick).toBeDisabled();
  await expect(controls.getByRole('button', { name: 'Pick up, drop, or throw prop' })).toBeDisabled();
  await expect(controls.getByRole('group', { name: 'Movement joystick' })).toHaveAttribute('aria-disabled', 'true');
  expect(await hitTarget()).toBe('Pause match');
  await quick.dispatchEvent('pointerdown', { pointerId: 9, pointerType: 'touch', isPrimary: true, button: 0 });
  await pause.click({ timeout: 5_000 });
  await expect(page.locator('.pause-overlay')).toHaveCount(0);
  await page.waitForTimeout(350);
  expect(Number(await hud.locator('[data-action-executed]').getAttribute('data-action-executed'))).toBe(executedBeforePause);
});
