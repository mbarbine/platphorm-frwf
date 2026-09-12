import { expectAttackPresentation, pressAttack } from './helpers/attackEvidence';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

test.use({ video: 'on' });

const enterOrdinarySingles = async (page: Page, difficulty: 'easy' | 'normal' = 'normal'): Promise<void> => {
  await page.goto('/');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: /^SINGLES/ }).click();
  await page.getByRole('button', { name: /^STANDARD/ }).click();
  if (difficulty === 'easy') await page.getByRole('button', { name: /^EASY/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-fighters-ready', 'true', { timeout: 45000 });
};

const exerciseOrdinaryInputs = async (page: Page): Promise<void> => {
  test.setTimeout(180_000);
  await enterOrdinarySingles(page, 'easy');
  const hud = page.locator('.hud'); const root = page.locator('html');
  await expect(hud).toHaveAttribute('data-match-mode', 'singles');
  await expect(hud).toHaveAttribute('data-physics-bodies', '32', { timeout: 30_000 });
  await expect(root).toHaveAttribute('data-game-input-ready', 'true', { timeout: 15_000 });
  await page.evaluate(() => {
    const sample = (): void => {
      const live = document.querySelector('.hud'); if (!live) return;
      const feedback = live.querySelector('[data-last-action]');
      if (feedback?.getAttribute('data-last-action-status') === 'interrupted') {
        const sequence = feedback.getAttribute('data-last-action-sequence') ?? '';
        const strip = live.querySelector<HTMLElement>('[data-testid="action-strip"]');
        if (strip && document.documentElement.dataset.visibleInterruptionSequence !== sequence) {
          const rect = strip.getBoundingClientRect(); const style = getComputedStyle(strip);
          if (style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0) {
            document.documentElement.dataset.visibleInterruptionSequence = sequence;
            document.documentElement.dataset.visibleInterruptionText = strip.textContent ?? '';
            document.documentElement.dataset.visibleInterruptionFits = String(rect.x >= 0 && rect.right <= innerWidth && rect.y >= 0 && rect.bottom <= innerHeight);
          }
        }
      }
      const move = live.getAttribute('data-player-move') ?? '';
      if (live.getAttribute('data-player-state') === 'recovering') document.documentElement.dataset.sawOrdinaryAttackMotion = 'get_up';
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

  // The rival remains live. Explicitly refused presses may be retried, while
  // an accepted but interrupted move must retain truthful outcome evidence.
  await pressAttack(page, hud, 'j');
  await expectAttackPresentation(page, hud, /jab|combo/);
  await expect.poll(async () => await hud.getAttribute('data-player-state'), { timeout: 15_000, intervals: [100, 200, 400] }).toMatch(/idle|locomotion/);

  // Jump while retreating into open space. Stopping and waiting for idle
  // gives the live rival a new attack window before the jump press.
  let restingY: number;
  await page.keyboard.down('Shift'); await page.keyboard.down('s');
  try {
    await expect.poll(async () => hud.evaluate(el => Math.hypot(Number(el.getAttribute('data-player-x')) - Number(el.getAttribute('data-opponent-x')), Number(el.getAttribute('data-player-z')) - Number(el.getAttribute('data-opponent-z')))), { timeout: 15000, intervals: [100] }).toBeGreaterThan(3.3);
    restingY = Number(await hud.getAttribute('data-player-pelvis-y'));
    await page.keyboard.press('c');
  } finally { await page.keyboard.up('s'); await page.keyboard.up('Shift'); }
  await expect(hud.locator('[data-last-action]')).toHaveAttribute('data-last-action', 'jump');
  await expect(hud.locator('[data-last-action]')).toHaveAttribute('data-last-action-status', 'executed');
  await expect(root).toHaveAttribute('data-saw-ordinary-jump', 'true', { timeout: 8_000 });
  await expect.poll(async () => Number(await root.getAttribute('data-ordinary-jump-peak-y')), { timeout: 8_000 }).toBeGreaterThan(restingY + .2);
  await expect.poll(async () => await hud.getAttribute('data-player-state'), { timeout: 12_000, intervals: [100, 200, 400] }).toMatch(/idle|locomotion|downed|recovering/);
  await expect.poll(async () => Number(await hud.getAttribute('data-player-vertical')), { timeout: 5_000 }).toBeLessThan(.2);

  // Test the heavy action where the jump lands. A second identical retreat
  // would run into the same ropes; space is not a prerequisite for a strike.
  await page.evaluate(() => { delete document.documentElement.dataset.sawOrdinaryAttackMotion; });
  await pressAttack(page, hud, 'k');
  await expectAttackPresentation(page, hud, /front_kick|low_kick|high_kick|roundhouse|stiff_arm|rebound/);
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0');
};

for (const layout of [
  { name: 'desktop', viewport: { width: 1280, height: 720 } },
  { name: 'phone layout', viewport: { width: 390, height: 844 } },
]) {
  test.describe(layout.name, () => {
    test.use({ viewport: layout.viewport });
    test('Easy Singles executes strike keys visibly and a jump returns control', async ({ page }) => exerciseOrdinaryInputs(page));
  });
}

test('ordinary Singles AI pursues and physically attacks an idle player', async ({ page }) => {
  test.setTimeout(180_000);
  await enterOrdinarySingles(page);
  const hud = page.locator('.hud'); const root = page.locator('html');
  await expect(hud).toHaveAttribute('data-physics-bodies', '32', { timeout: 30_000 });
  await page.evaluate(() => {
    const sample = (): void => {
      const live = document.querySelector('.hud'); if (!live) return;
      const move = live.getAttribute('data-opponent-move') ?? '';
      if (live.getAttribute('data-player-state') === 'recovering') document.documentElement.dataset.sawOrdinaryAttackMotion = 'get_up';
      if (move && move !== 'taunt') document.documentElement.dataset.sawIdleOpponentAttack = move;
      const readout = live.querySelector('[data-testid="impact-readout"]');
      if (readout?.getAttribute('data-impact-owner') === 'opponent') document.documentElement.dataset.sawPlayerHitReadout = 'true';
    };
    new MutationObserver(sample).observe(document.body, { subtree: true, attributes: true, childList: true }); sample();
  });
  // Deliberately send no gameplay input. A live Singles opponent must close
  // distance and land contact against the idle player under its own AI.
  await expect(root).toHaveAttribute('data-saw-idle-opponent-attack', /.+/, { timeout: 45_000 });
  await expect.poll(async () => Number(await hud.getAttribute('data-player-health')), {
    timeout: 60_000, intervals: [250, 500, 1000],
  }).toBeLessThan(100);
  await expect(root).toHaveAttribute('data-saw-player-hit-readout', 'true');
  await expect.poll(async () => Number(await hud.getAttribute('data-total-damage')), { timeout: 10_000 }).toBeGreaterThan(0);
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0');
});
