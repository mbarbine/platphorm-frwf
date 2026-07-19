import { expect, test } from '@playwright/test';

test('fighter select through guarded combat, deterministic lab result, and rematch cleanup', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto('/?physicsLab=1');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /CHAD “THE CLAW” KINSEY/ }).click();
  await expect(page.getByRole('heading', { name: 'FIGHTER SELECT' })).toBeInViewport();
  await expect(page.getByText('CLAW HAMMER')).toBeVisible();
  await expect(page.locator('.fighter-preview canvas')).toBeVisible();
  await page.getByRole('button', { name: /LOCK IN CHAD/ }).click();
  for (let beer = 0; beer < 5; beer += 1) await page.getByRole('button', { name: 'DRINK A BEER' }).click();
  await expect(page.getByText('5 / 5 DRUNK')).toBeVisible();
  await page.getByRole('button', { name: /^SINGLES/ }).click();
  await page.getByRole('button', { name: /^STANDARD/ }).click();
  await page.getByRole('button', { name: /^NORMAL/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();

  const hud = page.locator('.hud');
  await expect(page.getByTestId('game-canvas')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-game-input-ready', 'true');
  await expect(hud).toHaveAttribute('data-player-stamina', /^98\./);
  await page.keyboard.down('i');
  await expect(hud).toHaveAttribute('data-player-state', 'blocking');
  const guardedStamina = Number(await hud.getAttribute('data-player-stamina'));
  await page.waitForTimeout(500);
  expect(Number(await hud.getAttribute('data-player-stamina'))).toBeLessThan(guardedStamina);
  await page.keyboard.up('i');

  const rematch = page.getByRole('button', { name: 'INSTANT REMATCH' });
  await page.getByTestId('physics-lab').getByRole('button', { name: 'LAB KNOCKOUT' }).click();
  await expect(rematch).toBeVisible({ timeout: 8_000 });
  await expect(page.getByText(/WINS BY (PINFALL|KNOCKOUT)/)).toBeVisible();
  await page.getByRole('button', { name: 'INSTANT REMATCH' }).click();
  await expect(page.getByTestId('game-canvas')).toBeVisible();
  await expect(hud).toHaveAttribute('data-player-health', '100.0');
  await expect(hud).toHaveAttribute('data-player-stamina', /^98\./);
  expect(consoleErrors).toEqual([]);
});
