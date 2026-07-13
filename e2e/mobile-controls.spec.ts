import { expect, test } from '@playwright/test';

test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

test('mobile player can enter a match, move, guard, and attack', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();

  const controls = page.getByTestId('mobile-controls'); const hud = page.locator('.hud');
  await expect(controls).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-game-input-ready', 'true', { timeout: 30_000 });
  await expect(hud).toHaveAttribute('data-physics-bodies', '32', { timeout: 30_000 });
  const quick = page.getByRole('button', { name: 'Quick strike' });
  await expect(quick).toBeVisible();
  await expect(page.getByRole('button', { name: 'Heavy strike or stiff-arm' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Grapple' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Jump' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pick up, drop, or throw prop' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Taunt' })).toBeVisible();

  const stick = page.getByRole('group', { name: 'Movement joystick' }); const box = await stick.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const before = { x: Number(await hud.getAttribute('data-player-x')), z: Number(await hud.getAttribute('data-player-z')) };
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width * .82, box.y + box.height / 2);
  await expect(page.locator('.context-hint')).toContainText('TOUCH ACTIVE'); await page.waitForTimeout(550); await page.mouse.up();
  const after = { x: Number(await hud.getAttribute('data-player-x')), z: Number(await hud.getAttribute('data-player-z')) };
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(.12);

  await expect.poll(async () => {
    const playerX = Number(await hud.getAttribute('data-player-x')); const playerZ = Number(await hud.getAttribute('data-player-z'));
    const opponentX = Number(await hud.getAttribute('data-opponent-x')); const opponentZ = Number(await hud.getAttribute('data-opponent-z'));
    return Math.hypot(playerX - opponentX, playerZ - opponentZ);
  }, { timeout: 15_000 }).toBeLessThan(1.85);
  await expect.poll(async () => await hud.getAttribute('data-player-state'), { timeout: 20_000, intervals: [100, 200] }).toMatch(/idle|locomotion/);
  await page.evaluate(() => {
    const hudNode = document.querySelector('.hud'); if (!hudNode) return;
    const observe = (): void => { if (/jab|combo/.test(hudNode.getAttribute('data-player-move') ?? '')) document.documentElement.dataset.sawTouchAttack = 'true'; };
    new MutationObserver(observe).observe(hudNode, { attributes: true }); observe();
  });
  await expect.poll(async () => {
    await quick.dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0 });
    return page.locator('html').getAttribute('data-saw-touch-attack');
  }, { timeout: 8_000, intervals: [120, 180, 240, 320] }).toBe('true');
  await expect(page.locator('.context-hint')).toContainText('TOUCH ACTIVE');

  const guard = page.getByRole('button', { name: 'Hold GUARD' });
  await expect.poll(async () => await hud.getAttribute('data-player-state'), { timeout: 20_000, intervals: [100, 200] }).toMatch(/idle|locomotion/);
  await guard.hover(); await page.mouse.down();
  await expect(guard).toHaveAttribute('aria-pressed', 'true'); await page.mouse.up(); await expect(guard).toHaveAttribute('aria-pressed', 'false');
});
