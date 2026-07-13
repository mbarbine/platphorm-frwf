import { expect, test } from '@playwright/test';

test('Bodyworks lab exposes live Rapier diagnostics and drives real jump/walk input', async ({ page }) => {
  const errors: string[] = []; page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); }); page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?physicsLab=1');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: /^STANDARD/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();
  const hud = page.locator('.hud'); const lab = page.getByTestId('physics-lab'); const deck = page.getByTestId('control-deck');
  await expect(lab).toBeVisible(); await expect(hud).toHaveAttribute('data-physics-bodies', '32', { timeout: 30_000 }); await expect(hud).toHaveAttribute('data-physics-joints', '30');
  await expect(deck).toBeVisible(); await expect(deck).toContainText('LIVE WRESTLING CONTROLS');
  for (const label of ['MOVE / AIM', 'RUN', 'CIRCUIT JAB', 'FAULT HOOK', 'CLOSE DISTANCE', 'GUARD', 'COUNTER', 'JUMP / HOP', 'PICK UP PROP', 'WRESTLING ACTION', 'TAUNT']) await expect(deck).toContainText(label);
  await expect(hud).toHaveAttribute('data-player-state', 'idle');
  await page.waitForTimeout(2_500);
  const initialY = Number(await hud.getAttribute('data-player-pelvis-y'));
  await page.evaluate((startingY) => {
    const deckNode = document.querySelector('[data-testid="control-deck"]'); if (!deckNode) return;
    document.documentElement.dataset.maxJumpPelvisY = String(startingY);
    const observe = (): void => {
      if (deckNode.getAttribute('data-control-state')?.includes('AIRBORNE')) document.documentElement.dataset.sawAirborneControl = 'true';
      if (deckNode.querySelector('[data-control="jump"]')?.classList.contains('is-active')) document.documentElement.dataset.sawActiveJumpControl = 'true';
      const liveY = Number(document.querySelector('.hud')?.getAttribute('data-player-pelvis-y')); const maximum = Number(document.documentElement.dataset.maxJumpPelvisY);
      if (Number.isFinite(liveY) && liveY > maximum) document.documentElement.dataset.maxJumpPelvisY = String(liveY);
    };
    new MutationObserver(observe).observe(document.body, { subtree: true, attributes: true }); observe();
  }, initialY);
  const jump = lab.getByRole('button', { name: 'STANDING JUMP' }); await expect(jump).toBeEnabled(); await jump.click();
  await expect(page.locator('html')).toHaveAttribute('data-saw-active-jump-control', 'true'); await expect(page.locator('html')).toHaveAttribute('data-saw-airborne-control', 'true');
  await expect(lab.getByRole('button', { name: 'WALK + STOP' })).toBeEnabled({ timeout: 3_000 });
  expect(Number(await page.locator('html').getAttribute('data-max-jump-pelvis-y'))).toBeGreaterThan(initialY + .2);
  const initialX = Number(await hud.getAttribute('data-player-x')); const initialZ = Number(await hud.getAttribute('data-player-z'));
  await page.evaluate(() => {
    const deckNode = document.querySelector('[data-testid="control-deck"]'); if (!deckNode) return;
    const observe = (): void => { if (/MOVING|SPRINTING/.test(deckNode.getAttribute('data-control-state') ?? '')) document.documentElement.dataset.sawLocomotionControl = 'true'; };
    new MutationObserver(observe).observe(deckNode, { subtree: true, attributes: true }); observe();
  });
  await page.keyboard.down('w');
  await expect.poll(async () => Math.hypot(Number(await hud.getAttribute('data-player-x')) - initialX, Number(await hud.getAttribute('data-player-z')) - initialZ), { timeout: 2_800, intervals: [100] }).toBeGreaterThan(.35);
  await expect(page.locator('html')).toHaveAttribute('data-saw-locomotion-control', 'true');
  await expect(deck.locator('[data-control="quick"]')).toHaveAttribute('data-move-label', 'SKYLINE CROSS');
  await expect(deck.locator('[data-control="heavy"]')).toHaveAttribute('data-move-label', 'VOLTAGE UPPERCUT');
  await page.keyboard.up('w');
  await page.evaluate(() => {
    const deckNode = document.querySelector('[data-testid="control-deck"]'); if (!deckNode) return;
    const observe = (): void => {
      if (deckNode.getAttribute('data-control-state')?.includes('CIRCUIT JAB')) document.documentElement.dataset.sawJabControl = 'true';
      if (deckNode.querySelector('[data-control="quick"]')?.classList.contains('is-active')) document.documentElement.dataset.sawActiveQuickControl = 'true';
    };
    new MutationObserver(observe).observe(deckNode, { subtree: true, attributes: true }); observe();
  });
  await expect(lab.getByRole('button', { name: 'JAB TO HEAD' })).toBeEnabled({ timeout: 4_000 }); await lab.getByRole('button', { name: 'JAB TO HEAD' }).click();
  await expect(hud).toHaveAttribute('data-player-move', 'jab', { timeout: 2_000 }); await expect(page.locator('html')).toHaveAttribute('data-saw-active-quick-control', 'true'); await expect(page.locator('html')).toHaveAttribute('data-saw-jab-control', 'true');
  await expect(lab.getByRole('button', { name: 'ROPE LOAD + STIFF-ARM' })).toBeEnabled({ timeout: 3_000 });
  await page.evaluate(() => {
    const liveHud = document.querySelector('.hud'); const deckNode = document.querySelector('[data-testid="control-deck"]'); if (!liveHud || !deckNode) return;
    const observe = (): void => {
      if (liveHud.getAttribute('data-player-move') === 'stiff_arm') document.documentElement.dataset.sawStiffArm = 'true';
      if (deckNode.getAttribute('data-control-state')?.includes('ROPES LOADED') || deckNode.textContent?.includes('STIFF-ARM!')) document.documentElement.dataset.sawRopeCallout = 'true';
    };
    new MutationObserver(observe).observe(document.body, { subtree: true, attributes: true, childList: true }); observe();
  });
  await lab.getByRole('button', { name: 'ROPE LOAD + STIFF-ARM' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-saw-rope-callout', 'true', { timeout: 4_000 }); await expect(page.locator('html')).toHaveAttribute('data-saw-stiff-arm', 'true', { timeout: 4_000 });
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0'); expect(errors).toEqual([]);
});
