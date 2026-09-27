import { expect, test } from '@playwright/test';
import { RINGSIDE_THRESHOLD } from '../src/game/physics/ringDynamics';

test('player can leave through the center ropes and re-enter with the same context control', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/?physicsLab=1');
  await page.getByRole('button', { name: 'ENTER RINGFALL' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: /^STANDARD/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();

  const hud = page.locator('.hud');
  const lab = page.getByTestId('physics-lab');
  await expect(hud).toHaveAttribute('data-physics-authority', 'true', { timeout: 30_000 });

  // The lab places the player at the center-rope opening. Taking control with
  // the actual F key cancels scripted input before the first scheduled press.
  await lab.getByRole('button', { name: 'EXIT RING' }).click();
  await expect.poll(async () => Math.abs(Number(await hud.getAttribute('data-player-x'))), { timeout: 5_000 }).toBeGreaterThan(4.6);
  await page.keyboard.press('f');
  await expect(hud).toHaveAttribute('data-player-ringside', 'true', { timeout: 30_000 });
  await expect.poll(async () => Math.abs(Number(await hud.getAttribute('data-player-x'))), { timeout: 15_000 }).toBeGreaterThan(7);
  expect(Math.abs(Number(await hud.getAttribute('data-player-x')))).toBeGreaterThan(RINGSIDE_THRESHOLD.x);
  // The ringside flag changes at the rope line, before the body reaches the
  // apron landing. Wait for the physical transition anchor to finish before
  // issuing the return input.
  await page.waitForTimeout(1_200);

  // Pressing F again while crossing the opening must begin a physical return,
  // with the pelvis crossing back over the rope line and no emergency reset.
  await page.keyboard.press('f');
  await expect(hud).toHaveAttribute('data-player-ringside', 'false', { timeout: 45_000 });
  await expect.poll(async () => Math.abs(Number(await hud.getAttribute('data-player-x'))), { timeout: 15_000 }).toBeLessThan(5.3);
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0');
});
