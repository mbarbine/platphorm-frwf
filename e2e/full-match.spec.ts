import { expect, test } from '@playwright/test';

test('fighter select through guarded combat, grapple, result, and rematch', async ({ page }) => {
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
  await page.getByRole('button', { name: /CHAOS CIRCUIT/ }).click();
  await page.getByRole('button', { name: /^NORMAL/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();

  const hud = page.locator('.hud');
  await expect(page.getByTestId('game-canvas')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-game-input-ready', 'true');
  await expect(hud).toHaveAttribute('data-player-stamina', /^98\./);
  await page.evaluate(() => {
    const grappleMoves = new Set(['slam', 'suplex', 'takedown', 'whip', 'arm_drag', 'skyhook', 'powerbomb', 'clutch', 'spinebuster', 'side_toss', 'mountain_drop']);
    const observe = (): void => {
      const liveHud = document.querySelector('.hud'); if (!liveHud) return;
      const playerMove = liveHud.getAttribute('data-player-move') ?? ''; const opponentMove = liveHud.getAttribute('data-opponent-move') ?? '';
      const playerState = liveHud.getAttribute('data-player-state'); const opponentState = liveHud.getAttribute('data-opponent-state');
      if (playerState === 'grappling' || opponentState === 'grappling') document.documentElement.dataset.sawGrappleLock = 'true';
      if ((grappleMoves.has(playerMove) && liveHud.getAttribute('data-player-phase') === 'active') || (grappleMoves.has(opponentMove) && liveHud.getAttribute('data-opponent-phase') === 'active')) document.documentElement.dataset.sawGrappleImpact = 'true';
    };
    new MutationObserver(observe).observe(document.body, { subtree: true, attributes: true }); observe();
  });
  await page.keyboard.down('i');
  await expect(hud).toHaveAttribute('data-player-state', 'blocking');
  const guardedStamina = Number(await hud.getAttribute('data-player-stamina'));
  await page.waitForTimeout(500);
  expect(Number(await hud.getAttribute('data-player-stamina'))).toBeLessThan(guardedStamina);
  await page.keyboard.up('i');

  await page.keyboard.down('d');
  await page.keyboard.down('Shift');
  await page.waitForTimeout(950);
  await page.keyboard.up('Shift');
  await page.keyboard.up('d');

  const automationId = await page.evaluate(() => {
    let exchange = 0;
    const send = (type: 'keydown' | 'keyup', key: string, code: string): void => { window.dispatchEvent(new KeyboardEvent(type, { key, code, bubbles: true })); };
    const directions = [['w', 'KeyW'], ['d', 'KeyD'], ['s', 'KeyS'], ['a', 'KeyA']] as const;
    const attacks = [['l', 'KeyL'], ['j', 'KeyJ'], ['k', 'KeyK']] as const;
    return window.setInterval(() => {
      const direction = directions[exchange % directions.length] ?? directions[0];
      const attack = attacks[exchange % attacks.length] ?? attacks[0];
      send('keydown', direction[0], direction[1]);
      send('keydown', attack[0], attack[1]); send('keyup', attack[0], attack[1]);
      if (exchange % 4 === 0) { send('keydown', 'f', 'KeyF'); send('keyup', 'f', 'KeyF'); }
      if (exchange % 7 === 0) { send('keydown', ' ', 'Space'); send('keyup', ' ', 'Space'); }
      window.setTimeout(() => send('keyup', direction[0], direction[1]), 110);
      exchange += 1;
    }, 145);
  });

  await expect(page.getByRole('button', { name: 'INSTANT REMATCH' })).toBeVisible({ timeout: 180_000 });
  await page.evaluate((intervalId) => window.clearInterval(intervalId), automationId);
  await expect(page.getByText(/WINS BY (PINFALL|KNOCKOUT)/)).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-saw-grapple-lock', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-saw-grapple-impact', 'true');
  await page.getByRole('button', { name: 'INSTANT REMATCH' }).click();
  await expect(page.getByTestId('game-canvas')).toBeVisible();
  await expect(hud).toHaveAttribute('data-player-health', '100.0');
  await expect(hud).toHaveAttribute('data-player-stamina', /^98\./);
  expect(consoleErrors).toEqual([]);
});
