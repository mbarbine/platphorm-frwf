import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const serverPosition = async (canvas: Locator): Promise<{ x: number; z: number }> => ({
  x: Number(await canvas.getAttribute('data-network-server-x')),
  z: Number(await canvas.getAttribute('data-network-server-z')),
});

const distance = (first: { x: number; z: number }, second: { x: number; z: number }): number => Math.hypot(second.x - first.x, second.z - first.z);

const tapAndAwaitAuthority = async (page: Page, canvas: Locator, key: string, delay = 100): Promise<void> => {
  const commandBefore = Number(await canvas.getAttribute('data-network-command-seq'));
  const snapshotBefore = Number(await canvas.getAttribute('data-network-snapshot'));
  // WASD is sampled as a held movement intent. A synthetic one-frame key tap
  // can begin and end before the render/physics collector observes the hold.
  await page.keyboard.down(key);
  await page.waitForTimeout(delay);
  await page.keyboard.up(key);
  await expect.poll(async () => Number(await page.locator('html').getAttribute('data-input-action-count')),
    { message: `the active browser should collect the ${key} movement edge` }).toBeGreaterThan(0);
  await expect.poll(async () => Number(await canvas.getAttribute('data-network-command-seq')),
    { message: `the ${key} movement edge should be sent to the room` }).toBeGreaterThan(commandBefore);
  await expect.poll(async () => Number(await canvas.getAttribute('data-network-acked-seq'))).toBeGreaterThan(commandBefore);
  await expect.poll(async () => Number(await canvas.getAttribute('data-network-snapshot'))).toBeGreaterThan(snapshotBefore);
};

test.use({ actionTimeout: 15_000 });

test('two browsers share authoritative movement, contact, and impact state', async ({ browser, baseURL }) => {
  test.setTimeout(300_000);
  const hostContext = await browser.newContext({ recordVideo: { dir: 'test-results/online-host' } }); const guestContext = await browser.newContext({ recordVideo: { dir: 'test-results/online-guest' } });
  const host = await hostContext.newPage(); const guest = await guestContext.newPage();
  try {

    for (const page of [host, guest]) {
      await page.addInitScript(() => localStorage.setItem('ringfall-settings-v2', JSON.stringify({ graphicsQuality: 'performance', reducedMotion: true })));
      await page.goto(baseURL ?? '/');
      await page.getByRole('button', { name: 'ENTER RINGFALL' }).click();
      await page.getByRole('button', { name: 'PLAY ONLINE' }).click();
    }

    await host.getByRole('button', { name: 'HOST A MATCH' }).click();
    const shareLink = host.getByTestId('multiplayer-join-invite');
    await expect(shareLink).toHaveValue(/#room=/, { timeout: 20_000 });
    await guest.getByPlaceholder('PASTE PRIVATE INVITATION...').fill(await shareLink.inputValue());
    await guest.getByRole('button', { name: 'JOIN MATCH' }).click();
    await expect(host.getByText('PLAYER1 · HOST', { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(guest.getByText('PLAYER1 · HOST', { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(host.getByText('AWAITING OPPONENT...')).toHaveCount(0);

    await guest.getByRole('button', { name: 'READY TO FIGHT', exact: true }).click();
    await expect(host.getByRole('article', { name: 'PLAYER2 READY', exact: true })).toBeVisible();
    await expect(host.getByRole('article', { name: /OPEN SEAT/ })).toHaveCount(4);
    await expect(host.getByRole('button', { name: 'START MATCH', exact: true })).toBeEnabled();
    await host.getByRole('button', { name: 'START MATCH', exact: true }).click();
    const hostCanvas = host.getByTestId('game-canvas'); const guestCanvas = guest.getByTestId('game-canvas');
    await expect(hostCanvas).toHaveAttribute('data-online-role', 'player1', { timeout: 20_000 });
    await expect(guestCanvas).toHaveAttribute('data-online-role', 'player2', { timeout: 20_000 });
    await expect(hostCanvas).toHaveAttribute('data-network-authority', 'true');
    await expect(guestCanvas).toHaveAttribute('data-network-authority', 'true');
    await expect(hostCanvas).toHaveAttribute('data-network-status', 'connected');
    await expect(guestCanvas).toHaveAttribute('data-network-status', 'connected');
    await host.bringToFront();
    await expect.poll(async () => Number(await hostCanvas.getAttribute('data-network-snapshot')), { timeout: 45_000 }).toBeGreaterThan(0);
    await expect(hostCanvas).toHaveAttribute('data-simulation-ready', 'true', { timeout: 45000 });
    await expect(host.locator('html')).toHaveAttribute('data-game-input-ready', 'true');
    await guest.bringToFront();
    await expect(guestCanvas).toHaveAttribute('data-simulation-ready', 'true', { timeout: 45000 });
    await expect(guest.locator('html')).toHaveAttribute('data-game-input-ready', 'true');
    const guestBefore = await serverPosition(guestCanvas);
    await tapAndAwaitAuthority(guest, guestCanvas, 'w', 180);
    expect(distance(guestBefore, await serverPosition(guestCanvas))).toBeGreaterThan(.02);
    const guestCommandBefore = Number(await guestCanvas.getAttribute('data-network-acked-seq'));
    await guest.keyboard.press('j');
    await expect.poll(async () => Number(await guestCanvas.getAttribute('data-network-acked-seq'))).toBeGreaterThan(guestCommandBefore);
    // Browser contexts are foreground-throttled one at a time. Restore host
    // visibility before expecting its rAF-driven physics clock to advance.
    await host.bringToFront();
    await expect.poll(async () => Number(await hostCanvas.getAttribute('data-physics-steps')), { timeout: 20_000 }).toBeGreaterThan(30);

    for (let burst = 0; burst < 35; burst += 1) {
      const state = await hostCanvas.evaluate(element => ({
        x: Number(element.getAttribute('data-network-server-x')), z: Number(element.getAttribute('data-network-server-z')),
        targetX: Number(element.getAttribute('data-network-target-x')), targetZ: Number(element.getAttribute('data-network-target-z')),
        forwardX: Number(document.documentElement.dataset.inputForwardX), forwardZ: Number(document.documentElement.dataset.inputForwardZ),
      }));
      if (Math.hypot(state.targetX - state.x, state.targetZ - state.z) < 1.15) break;
      const candidates = [
        { key: 'w', x: state.forwardX, z: state.forwardZ },
        { key: 's', x: -state.forwardX, z: -state.forwardZ },
        { key: 'd', x: -state.forwardZ, z: state.forwardX },
        { key: 'a', x: state.forwardZ, z: -state.forwardX },
      ].sort((a, b) => (b.x - a.x) * (state.targetX - state.x) + (b.z - a.z) * (state.targetZ - state.z));
      await tapAndAwaitAuthority(host, hostCanvas, candidates[0]?.key ?? 'w', 180);
    }
    await expect(host.locator('html')).toHaveAttribute('data-input-last-action', 'move');
    await expect(host.locator('html')).toHaveAttribute('data-input-last-action-phase', 'released');
    await expect.poll(async () => Number(await host.locator('html').getAttribute('data-input-action-count'))).toBeGreaterThan(0);
    await expect.poll(async () => Number(await hostCanvas.getAttribute('data-network-command-seq'))).toBeGreaterThan(0);
    await expect.poll(async () => Number(await hostCanvas.getAttribute('data-network-acked-seq'))).toBeGreaterThan(0);
    const stoppedAt = await serverPosition(hostCanvas);
    await host.waitForTimeout(500);
    const stillStoppedAt = await serverPosition(hostCanvas);
    expect(distance(stoppedAt, stillStoppedAt), JSON.stringify({ stoppedAt, stillStoppedAt })).toBeLessThan(.08);
    const positions = { host: stillStoppedAt, guest: { x: Number(await hostCanvas.getAttribute('data-network-target-x')), z: Number(await hostCanvas.getAttribute('data-network-target-z')) } };
    expect(distance(positions.host, positions.guest), JSON.stringify(positions)).toBeLessThan(1.4);
    await host.keyboard.press('j');

    await expect.poll(async () => Number(await hostCanvas.getAttribute('data-opponent-health')), { timeout: 5_000 }).toBeLessThan(100);
    await expect.poll(async () => Number(await guestCanvas.getAttribute('data-player-x'))).toBeGreaterThan(-6);
    await expect.poll(async () => Number(await guest.getByRole('progressbar', { name: 'HEALTH', exact: true }).first().getAttribute('aria-valuenow'))).toBeLessThan(100);
    await host.screenshot({ path: 'test-results/online-host-contact.png' });
    await guest.screenshot({ path: 'test-results/online-guest-contact.png' });
    await expect(hostCanvas).toHaveAttribute('data-physics-emergency-resets', '0');
    await expect(guestCanvas).toHaveAttribute('data-physics-emergency-resets', '0');
    await guest.bringToFront();
    await guest.keyboard.press('Escape');
    await guest.getByRole('button', { name: 'QUIT TO MENU' }).click();
    await host.bringToFront();
    await expect(host.locator('html')).toHaveAttribute('data-camera-shot', 'online-last-standing-finish', { timeout: 10_000 });
    const finishHud = host.locator('.hud');
    await expect(finishHud).toHaveAttribute('data-player-state', 'victorious');
    await expect(finishHud).toHaveAttribute('data-opponent-state', 'defeated');
    await expect(host.locator('.announcement')).toContainText('WINS BY FORFEIT');
    await host.screenshot({ path: 'test-results/online-last-standing-finish.png' });
    await expect(host.getByText('WINS BY FORFEIT', { exact: true })).toBeVisible({ timeout: 45000 });
    await host.screenshot({ path: 'test-results/online-forfeit.png' });
  } finally {
    await hostContext.close(); await guestContext.close();
  }
});
