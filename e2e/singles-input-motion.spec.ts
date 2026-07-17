import { expect, test } from '@playwright/test';

const enterOrdinarySingles = async (page: import('@playwright/test').Page): Promise<void> => {
  await page.goto('/');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: /^STANDARD/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();
};

test('ordinary Singles executes strike keys visibly and a jump returns control', async ({ page }) => {
  test.setTimeout(180_000);
  await enterOrdinarySingles(page);
  const hud = page.locator('.hud'); const root = page.locator('html');
  await expect(hud).toHaveAttribute('data-match-mode', 'singles');
  await expect(hud).toHaveAttribute('data-physics-bodies', '32', { timeout: 30_000 });
  await expect(root).toHaveAttribute('data-game-input-ready', 'true', { timeout: 15_000 });
  await page.evaluate(() => {
    const sample = (): void => {
      const live = document.querySelector('.hud'); if (!live) return;
      const move = live.getAttribute('data-player-move') ?? '';
      if (move && move !== 'taunt') document.documentElement.dataset.sawOrdinaryAttackMotion = move;
      if (live.getAttribute('data-player-state') === 'jumping') {
        document.documentElement.dataset.sawOrdinaryJump = 'true';
        const pelvisY = Number(live.getAttribute('data-player-pelvis-y'));
        const peak = Number(document.documentElement.dataset.ordinaryJumpPeakY ?? 0);
        if (pelvisY > peak) document.documentElement.dataset.ordinaryJumpPeakY = pelvisY.toFixed(3);
      }
    };
    new MutationObserver(sample).observe(document.body, { subtree: true, attributes: true, childList: true }); sample();
  });

  await page.keyboard.press('j');
  await expect(hud.locator('[data-last-action]')).toHaveAttribute('data-last-action', 'quickStrike', { timeout: 8_000 });
  await expect(hud.locator('[data-last-action]')).toHaveAttribute('data-last-action-status', 'executed', { timeout: 8_000 });
  await expect(root).toHaveAttribute('data-saw-ordinary-attack-motion', /jab|combo/, { timeout: 8_000 });
  await expect.poll(async () => await hud.getAttribute('data-player-state'), { timeout: 8_000 }).toMatch(/idle|locomotion/);

  const restingY = Number(await hud.getAttribute('data-player-pelvis-y'));
  await page.keyboard.press('c');
  await expect(root).toHaveAttribute('data-saw-ordinary-jump', 'true', { timeout: 8_000 });
  await expect.poll(async () => Number(await root.getAttribute('data-ordinary-jump-peak-y')), { timeout: 8_000 }).toBeGreaterThan(restingY + .2);
  await expect.poll(async () => await hud.getAttribute('data-player-state'), { timeout: 12_000, intervals: [100, 200, 400] }).toMatch(/idle|locomotion/);
  await expect.poll(async () => Number(await hud.getAttribute('data-player-vertical')), { timeout: 5_000 }).toBeLessThan(.2);
  await expect.poll(async () => Number(await hud.getAttribute('data-player-support-feet')), { timeout: 5_000 }).toBeGreaterThan(0);

  await page.evaluate(() => { delete document.documentElement.dataset.sawOrdinaryAttackMotion; });
  await page.keyboard.press('k');
  await expect(hud.locator('[data-last-action]')).toHaveAttribute('data-last-action', 'heavyStrike', { timeout: 8_000 });
  await expect(hud.locator('[data-last-action]')).toHaveAttribute('data-last-action-status', 'executed', { timeout: 8_000 });
  await expect(root).toHaveAttribute('data-saw-ordinary-attack-motion', /front_kick|low_kick|high_kick|roundhouse/, { timeout: 8_000 });
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0');
});

test('ordinary Singles AI pursues and physically attacks an idle player', async ({ page }) => {
  test.setTimeout(180_000);
  await enterOrdinarySingles(page);
  const hud = page.locator('.hud'); const root = page.locator('html');
  await expect(hud).toHaveAttribute('data-physics-bodies', '32', { timeout: 30_000 });
  await page.evaluate(() => {
    const sample = (): void => {
      const live = document.querySelector('.hud'); if (!live) return;
      const move = live.getAttribute('data-opponent-move') ?? '';
      if (move && move !== 'taunt') document.documentElement.dataset.sawIdleOpponentAttack = move;
    };
    new MutationObserver(sample).observe(document.body, { subtree: true, attributes: true, childList: true }); sample();
  });
  // Deliberately send no gameplay input. A live Singles opponent must close
  // distance and land contact against the idle player under its own AI.
  await expect(root).toHaveAttribute('data-saw-idle-opponent-attack', /.+/, { timeout: 45_000 });
  await expect.poll(async () => Number(await hud.getAttribute('data-player-health')), {
    timeout: 60_000, intervals: [250, 500, 1000],
  }).toBeLessThan(100);
  await expect.poll(async () => Number(await hud.getAttribute('data-total-damage')), { timeout: 10_000 }).toBeGreaterThan(0);
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0');
});
