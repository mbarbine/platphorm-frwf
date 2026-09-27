import { expect, test } from '@playwright/test';

test('keyboard input advances a live physics-authority corner climb', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/?physicsLab=1');
  await page.getByRole('button', { name: 'ENTER RINGFALL' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: /^STANDARD/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();

  const stage = page.locator('.hud [data-player-climb-stage]');
  const climb = page.getByTestId('physics-lab').getByRole('button', { name: 'CLIMB + TAUNT' });
  await expect(climb).toBeEnabled({ timeout: 30_000 });
  await climb.click();
  await expect.poll(async () => Number(await stage.getAttribute('data-player-climb-stage')), {
    timeout: 45_000,
    intervals: [100, 200, 400, 800],
  }).toBe(2);

  // Trusted keyboard input takes control from the lab's scripted F presses,
  // so this verifies the same input listener the player uses in a live bout.
  await page.keyboard.press('f');
  await expect.poll(async () => Number(await stage.getAttribute('data-player-climb-stage')), {
    timeout: 10_000,
    intervals: [100, 200, 400],
  }).toBe(3);

  const momentum = page.locator('.hud [data-player-momentum]');
  const beforeTaunt = Number(await momentum.getAttribute('data-player-momentum'));
  await page.keyboard.press('q');
  await expect.poll(async () => Number(await momentum.getAttribute('data-player-momentum')), {
    timeout: 10_000,
    intervals: [100, 200, 400],
  }).toBeGreaterThan(beforeTaunt);

  const dive = page.getByTestId('physics-lab').getByRole('button', { name: 'TOP-ROPE DIVE' });
  await dive.click();
  await page.keyboard.press('f');
  await expect.poll(async () => Number(await stage.getAttribute('data-player-climb-stage')), {
    timeout: 45_000,
    intervals: [100, 200, 400, 800],
  }).toBe(2);
  await page.keyboard.press('f');
  await expect.poll(async () => Number(await stage.getAttribute('data-player-climb-stage')), {
    timeout: 10_000,
    intervals: [100, 200, 400],
  }).toBe(3);
  await page.evaluate(() => {
    const observe = (): void => {
      if (document.querySelector('.hud')?.getAttribute('data-player-move') === 'aerial') {
        document.documentElement.dataset.sawTrustedTopRopeAerial = 'true';
      }
    };
    new MutationObserver(observe).observe(document.body, { subtree: true, attributes: true });
    observe();
  });
  await page.keyboard.press('f');
  await expect(page.locator('html')).toHaveAttribute('data-saw-trusted-top-rope-aerial', 'true', { timeout: 15_000 });
});
