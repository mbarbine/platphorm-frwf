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
  for (const label of ['MOVE', 'RUN', 'QUICK', 'POWER', 'GRAPPLE', 'GUARD', 'COUNTER', 'JUMP', 'PROP', 'PIN / FINISH', 'TAUNT']) await expect(deck).toContainText(label);
  await expect(hud).toHaveAttribute('data-player-state', 'idle');
  await page.waitForTimeout(2_500);
  const initialY = Number(await hud.getAttribute('data-player-pelvis-y')); let apex = initialY;
  await page.evaluate(() => {
    const deckNode = document.querySelector('[data-testid="control-deck"]'); if (!deckNode) return;
    const observe = (): void => {
      if (deckNode.getAttribute('data-control-state')?.includes('AIRBORNE')) document.documentElement.dataset.sawAirborneControl = 'true';
      if (deckNode.querySelector('[data-control="jump"]')?.classList.contains('is-active')) document.documentElement.dataset.sawActiveJumpControl = 'true';
    };
    new MutationObserver(observe).observe(deckNode, { subtree: true, attributes: true }); observe();
  });
  const jump = lab.getByRole('button', { name: 'STANDING JUMP' }); await expect(jump).toBeEnabled(); await jump.click();
  await expect(hud).toHaveAttribute('data-player-state', 'jumping', { timeout: 2_500 });
  await expect(page.locator('html')).toHaveAttribute('data-saw-active-jump-control', 'true'); await expect(page.locator('html')).toHaveAttribute('data-saw-airborne-control', 'true');
  await expect.poll(async () => { apex = Math.max(apex, Number(await hud.getAttribute('data-player-pelvis-y'))); return apex; }, { timeout: 7_000, intervals: [50, 100] }).toBeGreaterThan(initialY + .2);
  await expect(lab.getByRole('button', { name: 'WALK + STOP' })).toBeEnabled({ timeout: 3_000 });
  const initialX = Number(await hud.getAttribute('data-player-x')); const initialZ = Number(await hud.getAttribute('data-player-z'));
  await lab.getByRole('button', { name: 'WALK + STOP' }).click();
  await expect.poll(async () => Math.hypot(Number(await hud.getAttribute('data-player-x')) - initialX, Number(await hud.getAttribute('data-player-z')) - initialZ), { timeout: 2_100, intervals: [100] }).toBeGreaterThan(.35);
  await expect.poll(async () => await deck.getAttribute('data-control-state'), { timeout: 2_100, intervals: [50, 100] }).toMatch(/MOVING|SPRINTING/);
  await expect(lab.getByRole('button', { name: 'JAB TO HEAD' })).toBeEnabled({ timeout: 3_000 }); await lab.getByRole('button', { name: 'JAB TO HEAD' }).click();
  await expect(hud).toHaveAttribute('data-player-move', 'jab', { timeout: 2_000 }); await expect(deck.locator('[data-control="quick"]')).toHaveClass(/is-active/); await expect(deck).toHaveAttribute('data-control-state', /CIRCUIT JAB/);
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0'); expect(errors).toEqual([]);
});
