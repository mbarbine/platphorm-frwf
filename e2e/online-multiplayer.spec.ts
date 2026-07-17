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
  await page.keyboard.press(key, { delay });
  await expect.poll(async () => Number(await canvas.getAttribute('data-network-acked-seq'))).toBeGreaterThan(commandBefore);
  await expect.poll(async () => Number(await canvas.getAttribute('data-network-snapshot'))).toBeGreaterThan(snapshotBefore);
};

test('two browsers share authoritative movement, contact, and impact state', async ({ browser, baseURL }) => {
  test.setTimeout(150_000);
  const hostContext = await browser.newContext(); const guestContext = await browser.newContext();
  const host = await hostContext.newPage(); const guest = await guestContext.newPage();
  try {
    for (const page of [host, guest]) {
      await page.goto(baseURL ?? '/');
      await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
      await page.getByRole('button', { name: 'PLAY ONLINE' }).click();
    }

    await host.getByRole('button', { name: 'CREATE PRIVATE ROOM' }).click();
    const roomCode = (await host.getByTestId('multiplayer-room-code').textContent())?.trim();
    expect(roomCode).toBeTruthy();
    await guest.getByPlaceholder('ENTER ROOM CODE...').fill(roomCode ?? '');
    await guest.getByRole('button', { name: 'JOIN MATCH' }).click();
    await expect(host.getByText('PLAYER 2 (CHALLENGER)')).toBeVisible();
    await expect(host.getByText('AWAITING OPPONENT...')).toHaveCount(0);

    await Promise.all([
      host.getByRole('button', { name: 'READY TO FIGHT' }).click(),
      guest.getByRole('button', { name: 'READY TO FIGHT' }).click(),
    ]);
    const hostCanvas = host.getByTestId('game-canvas'); const guestCanvas = guest.getByTestId('game-canvas');
    await expect(hostCanvas).toHaveAttribute('data-online-role', 'player1', { timeout: 20_000 });
    await expect(guestCanvas).toHaveAttribute('data-online-role', 'player2', { timeout: 20_000 });
    await expect(hostCanvas).toHaveAttribute('data-network-authority', 'true');
    await expect(guestCanvas).toHaveAttribute('data-network-authority', 'true');
    await expect.poll(async () => Number(await hostCanvas.getAttribute('data-network-snapshot'))).toBeGreaterThan(0);
    await expect(host.locator('html')).toHaveAttribute('data-game-input-ready', 'true', { timeout: 20_000 });
    await expect(guest.locator('html')).toHaveAttribute('data-game-input-ready', 'true', { timeout: 20_000 });
    await expect.poll(async () => Number(await hostCanvas.getAttribute('data-physics-steps')), { timeout: 20_000 }).toBeGreaterThan(30);

    await host.bringToFront();
    const sampleStart = await serverPosition(hostCanvas); const sampleTarget = await serverPosition(guestCanvas);
    await tapAndAwaitAuthority(host, hostCanvas, 'w');
    const sampleEnd = await serverPosition(hostCanvas); const sampleDx = sampleEnd.x - sampleStart.x; const sampleDz = sampleEnd.z - sampleStart.z; const sampleMagnitude = Math.hypot(sampleDx, sampleDz);
    expect(sampleMagnitude).toBeGreaterThan(.02);
    const forward = { x: sampleDx / sampleMagnitude, z: sampleDz / sampleMagnitude };
    const movementSamples = [
      { key: 'w', x: forward.x, z: forward.z },
      { key: 's', x: -forward.x, z: -forward.z },
      { key: 'd', x: -forward.z, z: forward.x },
      { key: 'a', x: forward.z, z: -forward.x },
    ].map((candidate) => ({ key: candidate.key, score: candidate.x * (sampleTarget.x - sampleEnd.x) + candidate.z * (sampleTarget.z - sampleEnd.z) }));
    const towardOpponent = movementSamples.sort((a, b) => b.score - a.score)[0];
    expect(towardOpponent?.score, JSON.stringify(movementSamples)).toBeGreaterThan(0);
    for (let burst = 0; burst < 12; burst += 1) {
      if (distance(await serverPosition(hostCanvas), await serverPosition(guestCanvas)) < 1.15) break;
      await tapAndAwaitAuthority(host, hostCanvas, towardOpponent?.key ?? 'w', 260);
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
    const positions = { host: stillStoppedAt, guest: await serverPosition(guestCanvas) };
    expect(distance(positions.host, positions.guest), JSON.stringify(positions)).toBeLessThan(1.4);
    await host.keyboard.press('j');

    await expect.poll(async () => Number(await hostCanvas.getAttribute('data-opponent-health')), { timeout: 5_000 }).toBeLessThan(100);
    await expect.poll(async () => Number(await guestCanvas.getAttribute('data-player-x'))).toBeGreaterThan(-6);
    await expect(hostCanvas).toHaveAttribute('data-physics-emergency-resets', '0');
    await expect(guestCanvas).toHaveAttribute('data-physics-emergency-resets', '0');
  } finally {
    await hostContext.close(); await guestContext.close();
  }
});
