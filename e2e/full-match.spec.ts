import { expect, test } from '@playwright/test';

test('fighter select through guarded combat, grapple, result, and rematch', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto('/');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY' }).click();
  await page.getByRole('button', { name: /CHAD “THE CLAW” KINSEY/ }).click();
  await expect(page.getByText('CLAW HAMMER')).toBeVisible();
  await expect(page.locator('.fighter-preview canvas')).toBeVisible();
  await page.getByRole('button', { name: /LOCK IN CHAD/ }).click();
  for (let beer = 0; beer < 5; beer += 1) await page.getByRole('button', { name: 'DRINK A BEER' }).click();
  await expect(page.getByText('5 / 5 DRUNK')).toBeVisible();
  await page.getByRole('button', { name: /CHAOS CIRCUIT/ }).click();
  await page.getByRole('button', { name: /^NORMAL/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();

  const hud = page.locator('.hud');
  await expect(page.getByTestId('game-canvas')).toBeVisible();
  await expect(hud).toHaveAttribute('data-player-stamina', /^98\./);
  await page.keyboard.down('KeyI');
  await expect(hud).toHaveAttribute('data-player-state', 'blocking');
  const guardedStamina = Number(await hud.getAttribute('data-player-stamina'));
  await page.waitForTimeout(500);
  expect(Number(await hud.getAttribute('data-player-stamina'))).toBeLessThan(guardedStamina);
  await page.keyboard.up('KeyI');

  await page.keyboard.down('KeyD');
  await page.keyboard.down('ShiftLeft');
  await page.waitForTimeout(950);
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.up('KeyD');

  for (let exchange = 0; exchange < 220 && await page.getByRole('button', { name: 'INSTANT REMATCH' }).count() === 0; exchange += 1) {
    const direction = ['KeyW', 'KeyD', 'KeyS', 'KeyA'][exchange % 4] ?? 'KeyD';
    await page.keyboard.down(direction);
    await page.keyboard.press(exchange % 3 === 0 ? 'KeyL' : exchange % 3 === 1 ? 'KeyJ' : 'KeyK');
    if (exchange % 4 === 0) await page.keyboard.press('KeyF');
    if (exchange % 7 === 0) await page.keyboard.press('Space');
    await page.waitForTimeout(120);
    await page.keyboard.up(direction);
  }

  await expect(page.getByRole('button', { name: 'INSTANT REMATCH' })).toBeVisible({ timeout: 25_000 });
  await expect(page.getByText(/WINS BY (PINFALL|KNOCKOUT)/)).toBeVisible();
  await page.getByRole('button', { name: 'INSTANT REMATCH' }).click();
  await expect(page.getByTestId('game-canvas')).toBeVisible();
  await expect(hud).toHaveAttribute('data-player-health', '100.0');
  await expect(hud).toHaveAttribute('data-player-stamina', /^98\./);
  expect(consoleErrors).toEqual([]);
});
