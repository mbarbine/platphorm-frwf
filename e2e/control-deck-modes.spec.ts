import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

type ControlDeckMode = 'full' | 'compact' | 'prompts' | 'hidden';

const enterLab = async (page: Page, mode: ControlDeckMode, tutorialComplete = true): Promise<void> => {
  await page.addInitScript(({ controlDeckMode, tutorialDone }) => {
    localStorage.setItem('ringfall-settings-v1', JSON.stringify({ controlDeckMode }));
    if (tutorialDone) localStorage.setItem('ringfall-tutorial-complete-v1', 'true');
    else localStorage.removeItem('ringfall-tutorial-complete-v1');
  }, { controlDeckMode: mode, tutorialDone: tutorialComplete });
  await page.goto('/?physicsLab=1');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();
  await expect(page.locator('.hud')).toHaveAttribute('data-physics-bodies', '32', { timeout: 30_000 });
  await expect(page.locator('html')).toHaveAttribute('data-game-input-ready', 'true', { timeout: 15_000 });
};

test('full deck exposes every binding with exact resolver-owned context and prop labels', async ({ page }) => {
  await enterLab(page, 'full');
  const hud = page.locator('.hud'); const deck = page.getByTestId('control-deck');
  await expect(hud).toHaveAttribute('data-control-deck-mode', 'full');
  await expect(deck).toHaveAttribute('data-control-mode', 'full');
  await expect(deck.locator('li')).toHaveCount(11);
  await expect(deck.locator('[data-control="quick"]')).toHaveAttribute('data-move-label', 'CIRCUIT JAB');
  await expect(deck.locator('[data-control="heavy"]')).toHaveAttribute('data-move-label', 'PISTON BOOT');
  await expect(deck.locator('[data-control="context"]')).toHaveAttribute('data-move-label', 'NO CONTEXT ACTION');
  await expect(deck.locator('[data-control="interact"]')).toHaveAttribute('data-move-label', 'NO PROP ACTION');
});

test('compact deck shows five exact actions and neutral collar lock starts the default body slam', async ({ page }) => {
  await enterLab(page, 'compact');
  const hud = page.locator('.hud'); const deck = page.getByTestId('control-deck'); const lab = page.getByTestId('physics-lab');
  await expect(hud).toHaveAttribute('data-control-deck-mode', 'compact');
  await expect(deck).toHaveAttribute('data-control-mode', 'compact');
  await expect(deck.locator('li')).toHaveCount(5);
  await expect(deck.locator('[data-control="quick"]')).toHaveAttribute('data-move-label', 'CIRCUIT JAB');
  await expect(deck.locator('[data-control="heavy"]')).toHaveAttribute('data-move-label', 'PISTON BOOT');
  await expect(deck.locator('[data-control="context"]')).toHaveAttribute('data-move-label', 'NO CONTEXT ACTION');
  await expect(deck.locator('[data-control="context"]')).toHaveAttribute('data-move-label', await deck.getAttribute('data-context-preview') ?? '');

  const rangeSetup = lab.getByRole('button', { name: 'CLOSE-RANGE INPUT' });
  await rangeSetup.click(); await expect(rangeSetup).toBeEnabled({ timeout: 10_000 });
  await expect(deck.locator('[data-control="grapple"]')).toHaveAttribute('data-move-label', 'COLLAR LOCK');
  await page.evaluate(() => {
    const hudNode = document.querySelector('.hud');
    if (!hudNode) return;
    const observe = (): void => {
      if (hudNode.getAttribute('data-player-move') === 'slam') document.documentElement.dataset.sawDefaultBodySlam = 'true';
    };
    new MutationObserver(observe).observe(hudNode, { attributes: true }); observe();
  });
  await page.keyboard.press('l');
  await expect(page.getByTestId('action-strip')).toHaveAttribute('data-action-label', 'COLLAR LOCK', { timeout: 5_000 });
  await expect(hud.locator('[data-last-action]')).toHaveAttribute('data-last-action', 'grapple', { timeout: 10_000 });
  await expect(hud.locator('[data-last-action]')).toHaveAttribute('data-last-action-status', 'executed');
  await expect(page.locator('html')).toHaveAttribute('data-saw-default-body-slam', 'true');
});

test('prompts-only mode keeps exact contextual feedback without the full deck', async ({ page }) => {
  await enterLab(page, 'prompts');
  const hud = page.locator('.hud'); const lab = page.getByTestId('physics-lab');
  await expect(hud).toHaveAttribute('data-control-deck-mode', 'prompts');
  await expect(page.getByTestId('control-deck')).toHaveCount(0);
  await expect(page.locator('.context-hint')).toBeVisible();
  const rangeSetup = lab.getByRole('button', { name: 'CLOSE-RANGE INPUT' });
  await rangeSetup.click(); await expect(rangeSetup).toBeEnabled({ timeout: 10_000 });
  await page.keyboard.press('j');
  await expect(page.getByTestId('action-strip')).toHaveAttribute('data-action', 'quickStrike', { timeout: 10_000 });
  await expect(page.getByTestId('action-strip')).toHaveAttribute('data-action-label', 'CIRCUIT JAB');
});

test('hidden mode removes every coaching overlay while keeping the game running', async ({ page }) => {
  await enterLab(page, 'hidden', false);
  const hud = page.locator('.hud');
  await expect(hud).toHaveAttribute('data-control-deck-mode', 'hidden');
  await expect(page.getByTestId('control-deck')).toHaveCount(0);
  await expect(page.locator('.context-hint')).toHaveCount(0);
  await expect(page.locator('.tutorial')).toHaveCount(0);
  await page.keyboard.press('j');
  await expect(hud.locator('[data-last-action]')).toHaveAttribute('data-last-action', 'quickStrike', { timeout: 10_000 });
  await expect(page.getByTestId('action-strip')).toHaveCount(0);
});
