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

  // A trusted F key press takes control from the scripted climb and advances
  // the live physics-authority wrestler to the next turnbuckle stage.
  await page.keyboard.press('f');
  await expect.poll(async () => Number(await stage.getAttribute('data-player-climb-stage')), {
    timeout: 10_000,
    intervals: [100, 200, 400],
  }).toBe(3);
});
