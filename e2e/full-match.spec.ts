import { expect, test } from '@playwright/test';

test('fighter select through guarded combat, result, and rematch', async ({ page }) => {
  test.setTimeout(420_000);
  const consoleErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto('/');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /CHAD “THE CLAW” KINSEY/ }).click();
  await expect(page.getByRole('heading', { name: 'FIGHTER SELECT' })).toBeInViewport();
  await expect(page.getByText('CLAW HAMMER')).toBeVisible();
  await expect(page.locator('.fighter-preview canvas')).toBeVisible();
  await page.getByRole('button', { name: /LOCK IN CHAD/ }).click();
  for (let beer = 0; beer < 5; beer += 1) await page.getByRole('button', { name: 'DRINK A BEER' }).click();
  await expect(page.getByText('5 / 5 DRUNK')).toBeVisible();
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

  const rematch = page.getByRole('button', { name: 'INSTANT REMATCH' }); const replay = page.getByRole('button', { name: 'SKIP REPLAY' });
  const movement = ['w', 'a', 's', 'd'] as const; type MovementKey = (typeof movement)[number];
  let movementIndex = 0; let exchange = 0; let bestMovement: MovementKey | null = null;
  const separation = async (): Promise<number> => Math.hypot(
    Number(await hud.getAttribute('data-player-x')) - Number(await hud.getAttribute('data-opponent-x')),
    Number(await hud.getAttribute('data-player-z')) - Number(await hud.getAttribute('data-opponent-z')),
  );
  const deadline = Date.now() + 330_000;
  while (Date.now() < deadline && !(await rematch.isVisible())) {
    if (await replay.isVisible()) { await replay.click(); await page.waitForTimeout(180); continue; }
    if (!(await hud.isVisible())) { await page.waitForTimeout(180); continue; }
    const state = await hud.getAttribute('data-player-state'); const opponentState = await hud.getAttribute('data-opponent-state');
    if (state === 'downed') { await page.keyboard.press('Space'); await page.waitForTimeout(260); continue; }
    if (state === 'grappling') {
      await page.keyboard.down('w'); await page.keyboard.press('k'); await page.keyboard.up('w'); await page.waitForTimeout(1_250); continue;
    }
    if (!/idle|locomotion/.test(state ?? '')) { await page.waitForTimeout(180); continue; }
    const gap = await separation(); const stamina = Number(await hud.getAttribute('data-player-stamina'));
    if (gap > 1.62) {
      const key: MovementKey = bestMovement ?? movement[movementIndex] ?? 'w'; const before = gap;
      await page.keyboard.down('Shift'); await page.keyboard.down(key); await page.waitForTimeout(360); await page.keyboard.up(key); await page.keyboard.up('Shift');
      const after = await separation();
      if (after < before - .06) bestMovement = key;
      else { bestMovement = null; movementIndex = (movementIndex + 1) % movement.length; }
      continue;
    }
    if (opponentState === 'downed') await page.keyboard.press('f');
    else if (/staggered|downed/.test(opponentState ?? '') && Number(await hud.locator('[data-player-momentum]').getAttribute('data-player-momentum')) >= 99) await page.keyboard.press('f');
    else if (stamina >= 20 && exchange % 3 === 0) await page.keyboard.press('l');
    else await page.keyboard.press(stamina >= 15 && exchange % 3 === 1 ? 'k' : 'j');
    exchange += 1; await page.waitForTimeout(320);
  }

  await expect(rematch).toBeVisible({ timeout: 8_000 });
  await expect(page.getByText(/WINS BY (PINFALL|KNOCKOUT)/)).toBeVisible();
  await page.getByRole('button', { name: 'INSTANT REMATCH' }).click();
  await expect(page.getByTestId('game-canvas')).toBeVisible();
  await expect(hud).toHaveAttribute('data-player-health', '100.0');
  await expect(hud).toHaveAttribute('data-player-stamina', /^98\./);
  expect(consoleErrors).toEqual([]);
});
