import { expect, type Locator, type Page } from '@playwright/test';

/** Retry only an explicitly refused/expired press; never force a combat state. */
export async function pressAttack(page: Page, hud: Locator, key: 'j' | 'k'): Promise<void> {
  const action = key === 'j' ? 'quickStrike' : 'heavyStrike';
  for (let attempt = 0; attempt < 3; attempt++) {
    await expect.poll(async () => hud.getAttribute('data-player-state'), { timeout: 20_000 }).toMatch(/^(idle|locomotion|downed)$/);
    const previous = await hud.locator('[data-last-action]').getAttribute('data-last-action-sequence');
    await page.keyboard.press(key);
    let result = { status: '', reason: '' };
    await expect.poll(async () => {
      result = await hud.evaluate((el, expected) => {
        const feedback = el.querySelector('[data-last-action]');
        if (feedback?.getAttribute('data-last-action-sequence') === expected.previous || feedback?.getAttribute('data-last-action') !== expected.action) return { status: '', reason: '' };
        return { status: feedback?.getAttribute('data-last-action-status') ?? '', reason: feedback?.getAttribute('data-last-action-reason') ?? '' };
      }, { previous, action });
      return result.status;
    }, { timeout: 8_000 }).toMatch(/^(executed|interrupted|expired|rejected)$/);
    if (result.status === 'executed' || result.status === 'interrupted') return;
    expect(result.reason, 'An unavailable action must explain why').not.toBe('');
  }
  throw new Error(`${action} did not start within three ordinary input attempts`);
}

/** Acceptance is not animation: require matching rig frames or an explicit interruption. */
export async function expectAttackPresentation(page: Page, hud: Locator, moves: RegExp): Promise<void> {
  const feedback = hud.locator('[data-last-action]');
  const sequence = await feedback.getAttribute('data-last-action-sequence');
  const evidence = hud.locator('[data-attack-sequence]');
  await expect.poll(async () => {
    const state = await hud.evaluate(el => {
      const action = el.querySelector('[data-last-action]'); const attack = el.querySelector('[data-attack-sequence]');
      return {
        sequence: attack?.getAttribute('data-attack-sequence'), move: attack?.getAttribute('data-attack-move') ?? '',
        outcome: attack?.getAttribute('data-attack-outcome'), frames: Number(attack?.getAttribute('data-attack-pose-frames')),
        status: action?.getAttribute('data-last-action-status'), recovered: document.documentElement.dataset.sawOrdinaryAttackMotion === 'get_up',
      };
    });
    if (state.recovered && state.status === 'executed') return true;
    return state.sequence === sequence && moves.test(state.move)
      && (state.outcome === 'interrupted' && state.status === 'interrupted' || state.frames >= 2);
  }, { timeout: 8_000 }).toBe(true);
  if (await feedback.getAttribute('data-last-action-status') === 'interrupted') {
    await expect(evidence).toHaveAttribute('data-attack-outcome', 'interrupted');
    await expect(evidence).toHaveAttribute('data-attack-sequence', sequence ?? '');
    await expect(feedback).not.toHaveAttribute('data-last-action-reason', '');
    // Assert the actual rendered message at its event time. A slow browser
    // driver may finish these assertions after the short notification expires.
    const root = page.locator('html');
    await expect(root).toHaveAttribute('data-visible-interruption-sequence', sequence ?? '');
    await expect(root).toHaveAttribute('data-visible-interruption-text', /MOVE STOPPED/);
    await expect(root).toHaveAttribute('data-visible-interruption-fits', 'true');
  }
}
