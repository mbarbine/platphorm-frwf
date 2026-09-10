import { expect, test } from '@playwright/test';

test('plays an outdoor bout with real inputs and records only earned circuit progress', async ({ page }) => {
  test.setTimeout(240000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'EXPLORE SHOWGROUND' }).click();
  await page.getByRole('button', { name: 'LOCK IN ATLAS REX' }).click();
  const world = page.getByTestId('showground');
  await expect(page.locator('html')).toHaveAttribute('data-game-input-ready', 'true', { timeout: 30000 });
  await page.keyboard.down('w');
  try { await expect.poll(async () => Number(await world.getAttribute('data-world-z')), { timeout: 30000, intervals: [100] }).toBeLessThan(12.4); }
  finally { await page.keyboard.up('w'); }
  await page.getByRole('button', { name: /Backyard warm-up/ }).click();
  await page.getByRole('button', { name: 'START BOUT' }).click();
  const canvas = page.getByTestId('game-canvas'); const hud = page.locator('.hud');
  await expect(canvas).toHaveAttribute('data-simulation-ready', 'true', { timeout: 45000 });
  await expect(canvas).toHaveAttribute('data-combat-venue', 'yard');
  let grapples = 0; let sawLift = false; let sawDamage = false;
  const deadline = Date.now() + 150000;
  while (Date.now() < deadline && await hud.isVisible()) {
    const snapshot = await hud.evaluate(element => ({ state: element.getAttribute('data-player-state'), target: element.getAttribute('data-opponent-state'), phase: element.getAttribute('data-grapple-phase'), grapples: Number(element.getAttribute('data-player-grapples')), health: Number(element.getAttribute('data-opponent-health')), x: Number(element.getAttribute('data-player-x')), z: Number(element.getAttribute('data-player-z')), tx: Number(element.getAttribute('data-opponent-x')), tz: Number(element.getAttribute('data-opponent-z')) }));
    grapples = Math.max(grapples, snapshot.grapples); sawLift ||= snapshot.phase === 'lift'; sawDamage ||= snapshot.health < 99;
    if (snapshot.state === 'victorious' || snapshot.state === 'defeated') break;
    if (snapshot.state === 'pinned') await page.keyboard.press('f');
    else if (snapshot.state === 'downed' || snapshot.state === 'grabbed' || snapshot.state === 'staggered') await page.keyboard.press('Space');
    else if (snapshot.state === 'idle' || snapshot.state === 'locomotion') {
      const distance = Math.hypot(snapshot.tx - snapshot.x, snapshot.tz - snapshot.z);
      if (distance > 3.6) {
        const key = Math.abs(snapshot.tx - snapshot.x) > Math.abs(snapshot.tz - snapshot.z) ? snapshot.tx > snapshot.x ? 'd' : 'a' : snapshot.tz > snapshot.z ? 's' : 'w';
        await page.keyboard.down(key); await page.waitForTimeout(160); await page.keyboard.up(key);
      } else await page.keyboard.press(snapshot.target === 'downed' ? 'f' : 'l');
    }
    await page.waitForTimeout(130);
  }
  expect(grapples, 'At least one physical throw must complete').toBeGreaterThan(0);
  expect(sawDamage, 'Real contacts must cause damage').toBe(true);
  await page.screenshot({ path: 'test-results/circuit-bout-end-frame.png' });
  await expect(page.getByRole('button', { name: 'RETURN TO SHOWGROUND', exact: true })).toBeVisible({ timeout: 20000 });
  const outcome = await page.locator('.results-screen').innerText();
  await page.screenshot({ path: 'test-results/circuit-bout-outcome.png' });
  await page.getByRole('button', { name: 'RETURN TO SHOWGROUND', exact: true }).click();
  await expect(world).toBeVisible();
  await page.getByRole('button', { name: 'CIRCUIT', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Local wrestling circuit' })).toBeVisible();
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('frwf.showground.v1') ?? '{}'));
  expect(save.results.warmup.bouts).toBe(1);
  expect(save.results.warmup.wins).toBe(outcome.toUpperCase().includes('ATLAS REX') ? 1 : 0);
  if (save.results.warmup.wins) expect(save.medals.warmup).toContain('victory');
  else expect(save.medals.warmup).toEqual([]);
  await page.screenshot({ path: 'test-results/circuit-earned-progress.png' });
  expect(errors).toEqual([]);
  test.info().annotations.push({ type: 'observed-lift', description: String(sawLift) });
});
