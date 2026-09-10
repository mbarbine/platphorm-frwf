import { expect, test } from '@playwright/test';

test.use({ video: 'on', trace: 'off', actionTimeout: 15000 });

test('records the intermediate recovery poses as well as the returned movement control', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/?physicsLab=1');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();
  await expect(page.getByTestId('game-canvas')).toHaveAttribute('data-simulation-ready', 'true', { timeout: 45000 });
  const lab = page.getByTestId('physics-lab'); const hud = page.locator('.hud');
  const seconds = async () => Number(await hud.getAttribute('data-match-seconds'));
  const canvas = page.getByTestId('game-canvas');
  await lab.getByRole('button', { name: 'PAUSE', exact: true }).click();
  await expect(lab.getByRole('button', { name: 'PLAY', exact: true })).toBeVisible();
  for (let tick = 0; tick < 3; tick++) {
    const before = Number(await canvas.getAttribute('data-physics-steps'));
    await lab.getByRole('button', { name: 'STEP', exact: true }).click();
    await expect(canvas).toHaveAttribute('data-physics-steps', String(before + 1));
    await expect(lab.getByRole('button', { name: 'PLAY', exact: true })).toBeVisible();
  }
  await lab.getByRole('button', { name: '0.25×', exact: true }).click();
  await lab.getByRole('button', { name: 'PLAY', exact: true }).click();
  const paced = await page.evaluate(async () => {
    const hud = document.querySelector('.hud');
    const before = Number(hud?.getAttribute('data-match-seconds'));
    await new Promise(resolve => setTimeout(resolve, 1000));
    return Number(hud?.getAttribute('data-match-seconds')) - before;
  });
  expect(paced).toBeGreaterThan(.1); expect(paced).toBeLessThan(.45);

  for (const name of ['BACK', 'FRONT', 'SIDE']) {
    await lab.getByRole('button', { name: '0.25×', exact: true }).click();
    await lab.getByRole('button', { name: `${name} GET-UP`, exact: true }).click();
    await lab.getByRole('button', { name: 'MINIMIZE PHYSICS LAB' }).click();
    await expect(hud).toHaveAttribute('data-player-state', 'recovering', { timeout: 12000 });
    const start = await seconds();
    for (const offset of [.2, .5, .8, 1.1]) {
      await expect.poll(seconds, { timeout: 10000 }).toBeGreaterThanOrEqual(start + offset);
      await page.screenshot({ path: `test-results/recovery-${name.toLowerCase()}-${offset}.png` });
    }
    await expect(hud).toHaveAttribute('data-player-state', 'idle', { timeout: 15000 });
    expect(Number(await hud.getAttribute('data-player-upright'))).toBeGreaterThan(.9);
    expect(Number(await hud.getAttribute('data-player-support-feet'))).toBeGreaterThan(0);
    await lab.getByRole('button', { name: 'SHOW PHYSICS LAB' }).click();
  }
  await lab.getByRole('button', { name: 'TAKE CONTROL' }).click();
  const x = Number(await hud.getAttribute('data-player-x'));
  await page.keyboard.down('d');
  await expect.poll(async () => Number(await hud.getAttribute('data-player-x'))).toBeGreaterThan(x + .25);
  await page.keyboard.up('d');
  await expect(hud).toHaveAttribute('data-player-state', 'idle');
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0');
  expect(errors).toEqual([]);
});
