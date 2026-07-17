import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const pauseOnHudAttribute = async (page: Page, attribute: string, pattern: string, marker: string): Promise<void> => {
  await page.evaluate(({ attribute, pattern, marker }) => {
    const hud = document.querySelector('.hud'); if (!hud) throw new Error('HUD not mounted');
    const expression = new RegExp(pattern);
    let observer: MutationObserver | null = null;
    const inspect = (): void => {
      if (!expression.test(hud.getAttribute(attribute) ?? '')) return;
      document.documentElement.dataset[marker] = hud.getAttribute(attribute) ?? '';
      const pause = Array.from(document.querySelectorAll<HTMLButtonElement>('.physics-lab button')).find((button) => button.textContent?.trim() === 'PAUSE');
      pause?.click(); observer?.disconnect();
    };
    observer = new MutationObserver(inspect);
    observer.observe(hud, { attributes: true, attributeFilter: [attribute] }); inspect();
  }, { attribute, pattern, marker });
};

test('captures the shipping combat presentation at decisive motion beats', async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/?physicsLab=1');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: /^STANDARD/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();

  const hud = page.locator('.hud');
  const lab = page.getByTestId('physics-lab');
  await expect(hud).toHaveAttribute('data-physics-bodies', '32', { timeout: 30_000 });
  await lab.getByRole('button', { name: '0.25×' }).click();
  await page.screenshot({ path: testInfo.outputPath('01-neutral.png') });

  await pauseOnHudAttribute(page, 'data-player-phase', '^active$', 'capturedJab');
  await lab.getByRole('button', { name: 'CONTACT-TRUE JAB' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-captured-jab', 'active', { timeout: 20_000 });
  await page.screenshot({ path: testInfo.outputPath('02-jab-motion.png') });
  await lab.getByRole('button', { name: 'PLAY' }).click();
  await expect.poll(async () => Number(await hud.getAttribute('data-opponent-health')), { timeout: 12_000 }).toBeLessThan(100);
  await page.screenshot({ path: testInfo.outputPath('03-jab-impact.png') });

  await expect(lab).toHaveAttribute('data-lab-scenario', 'idle', { timeout: 30_000 });
  await expect(lab.getByRole('button', { name: 'DIRECTIONAL KICK' })).toBeEnabled({ timeout: 12_000 });
  await pauseOnHudAttribute(page, 'data-player-phase', '^active$', 'capturedKick');
  await lab.getByRole('button', { name: 'DIRECTIONAL KICK' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-captured-kick', 'active', { timeout: 20_000 });
  await page.screenshot({ path: testInfo.outputPath('04-kick-motion.png') });
  await lab.getByRole('button', { name: 'PLAY' }).click();

  await expect(lab).toHaveAttribute('data-lab-scenario', 'idle', { timeout: 30_000 });
  const slam = lab.getByRole('button', { name: 'BODY SLAM' });
  await expect(slam).toBeEnabled({ timeout: 20_000 });
  await pauseOnHudAttribute(page, 'data-grapple-phase', '^lift$', 'capturedSlam');
  await slam.click();
  await expect(page.locator('html')).toHaveAttribute('data-captured-slam', 'lift', { timeout: 90_000 });
  await page.screenshot({ path: testInfo.outputPath('05-slam-sequence.png') });
  await lab.getByRole('button', { name: 'PLAY' }).click();
  await expect(hud.locator('[data-replay-active="true"]')).toBeAttached({ timeout: 90_000 });
  await page.screenshot({ path: testInfo.outputPath('06-slam-replay.png') });

  await page.getByRole('button', { name: 'SKIP REPLAY' }).click();
  await pauseOnHudAttribute(page, 'data-opponent-state', '^(downed|recovering)$', 'capturedDeckRecovery');
  await expect.poll(async () => await page.locator('html').getAttribute('data-captured-deck-recovery'), { timeout: 20_000 }).toMatch(/downed|recovering/);
  // The lab panel is diagnostic-only and can cover the downed wrestler. Keep
  // the gameplay frame unobstructed while the paused camera settles.
  const unobstructedCaptureStyle = await page.addStyleTag({ content: '.physics-lab { visibility: hidden !important; }' });
  await page.waitForTimeout(1_200);
  await page.screenshot({ path: testInfo.outputPath('07-deck-safe-recovery.png') });
  await unobstructedCaptureStyle.evaluate((style) => (style as HTMLStyleElement).remove());
  await lab.getByRole('button', { name: 'PLAY' }).click();
  await expect.poll(async () => await hud.getAttribute('data-opponent-state'), { timeout: 45_000 }).toMatch(/idle|locomotion/);
  await page.screenshot({ path: testInfo.outputPath('08-post-slam-recovery.png') });
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0');
});
