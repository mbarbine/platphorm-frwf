import { expect, test } from '@playwright/test';

test('mobile player can enter a match, move, guard, and attack', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();

  const controls = page.getByTestId('mobile-controls'); const hud = page.locator('.hud');
  await expect(controls).toBeVisible();
  await expect(page.getByRole('button', { name: 'Quick strike' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Heavy strike or stiff-arm' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Grapple' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Jump' })).toBeVisible();

  const stick = page.getByRole('group', { name: 'Movement joystick' }); const box = await stick.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width * .82, box.y + box.height / 2);
  await expect(page.locator('.context-hint')).toContainText('TOUCH ACTIVE'); await expect(hud).toHaveAttribute('data-player-state', 'locomotion'); await page.mouse.up();

  const guard = page.getByRole('button', { name: 'Hold GUARD' });
  await guard.dispatchEvent('pointerdown', { pointerId: 22, pointerType: 'touch', clientX: 20, clientY: 20 });
  await expect(hud).toHaveAttribute('data-player-state', 'blocking');
  await guard.dispatchEvent('pointerup', { pointerId: 22, pointerType: 'touch', clientX: 20, clientY: 20 });
  await page.getByRole('button', { name: 'Quick strike' }).click(); await expect(hud).toHaveAttribute('data-player-move', /jab|combo/);
});
