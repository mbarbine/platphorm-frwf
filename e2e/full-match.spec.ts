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
      if (Number(liveHud.getAttribute('data-total-grapples')) > 0 || (grappleMoves.has(playerMove) && liveHud.getAttribute('data-player-phase') === 'active') || (grappleMoves.has(opponentMove) && liveHud.getAttribute('data-opponent-phase') === 'active')) document.documentElement.dataset.sawGrappleImpact = 'true';
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

  for (let tick = 0; tick < 60 && Number(await hud.getAttribute('data-total-grapples')) === 0; tick += 1) {
    const playerState = await hud.getAttribute('data-player-state'); const opponentState = await hud.getAttribute('data-opponent-state');
    const playerX = Number(await hud.getAttribute('data-player-x')); const playerZ = Number(await hud.getAttribute('data-player-z'));
    const opponentX = Number(await hud.getAttribute('data-opponent-x')); const opponentZ = Number(await hud.getAttribute('data-opponent-z'));
    const separation = Math.hypot(playerX - opponentX, playerZ - opponentZ);
    if (/idle|locomotion/.test(playerState ?? '') && !/blocking|downed|pinned|defeated/.test(opponentState ?? '') && separation <= 1.58) {
      await page.keyboard.press('l');
      await page.waitForTimeout(220);
      if (await hud.getAttribute('data-player-state') === 'grappling') {
        await page.keyboard.down('w'); await page.keyboard.press('k'); await page.keyboard.up('w');
      }
      await page.waitForTimeout(2_600);
    } else {
      await page.waitForTimeout(250);
    }
  }
  expect(Number(await hud.getAttribute('data-total-grapples'))).toBeGreaterThan(0);
  await expect(page.locator('.replay-overlay')).toBeVisible({ timeout: 6_000 });
  await expect(page.getByRole('button', { name: 'SKIP REPLAY' })).toBeVisible();
  await page.getByRole('button', { name: 'SKIP REPLAY' }).click();
  await expect(page.locator('.replay-overlay')).toHaveCount(0);

  const automationId = await page.evaluate(() => {
    let exchange = 0;
    const send = (type: 'keydown' | 'keyup', key: string, code: string): void => { window.dispatchEvent(new KeyboardEvent(type, { key, code, bubbles: true })); };
    const strike = (key: string, code: string, directional = false): void => {
      if (directional) send('keydown', 'w', 'KeyW');
      send('keydown', key, code); send('keyup', key, code);
      if (directional) send('keyup', 'w', 'KeyW');
    };
    return window.setInterval(() => {
      const liveHud = document.querySelector('.hud'); if (!liveHud) return;
      const state = liveHud.getAttribute('data-player-state') ?? ''; const opponentState = liveHud.getAttribute('data-opponent-state') ?? '';
      const stamina = Number(liveHud.getAttribute('data-player-stamina')); const momentum = Number(liveHud.querySelector('[data-player-momentum]')?.getAttribute('data-player-momentum'));
      const px = Number(liveHud.getAttribute('data-player-x')); const pz = Number(liveHud.getAttribute('data-player-z')); const ox = Number(liveHud.getAttribute('data-opponent-x')); const oz = Number(liveHud.getAttribute('data-opponent-z'));
      const separation = Math.hypot(px - ox, pz - oz);
      if (state === 'grappling') { strike('k', 'KeyK', true); return; }
      if (!/idle|locomotion/.test(state)) return;
      if (/downed|staggered/.test(opponentState) && momentum >= 99) { strike('f', 'KeyF'); return; }
      if (opponentState === 'downed') { strike(exchange % 3 === 0 ? 'j' : 'f', exchange % 3 === 0 ? 'KeyJ' : 'KeyF'); exchange += 1; return; }
      if (separation > 1.7 || stamina < 7) return;
      if (stamina >= 22 && exchange % 3 === 0) strike('l', 'KeyL');
      else if (stamina >= 15 && exchange % 3 === 1) strike('k', 'KeyK');
      else strike('j', 'KeyJ');
      exchange += 1;
    }, 360);
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
