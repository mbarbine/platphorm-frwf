import { expect, request, test } from '@playwright/test';
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
  await expect.poll(async () => Number(await page.locator('html').getAttribute('data-input-action-count')),
    { message: `the active browser should collect the ${key} movement edge` }).toBeGreaterThan(0);
  await expect.poll(async () => Number(await canvas.getAttribute('data-network-command-seq')),
    { message: `the ${key} movement edge should be sent to the room` }).toBeGreaterThan(commandBefore);
  await page.keyboard.up(key);
  await expect.poll(async () => Number(await canvas.getAttribute('data-network-acked-seq'))).toBeGreaterThan(commandBefore);
  await expect.poll(async () => Number(await canvas.getAttribute('data-network-snapshot'))).toBeGreaterThan(snapshotBefore);
};

test('two browsers share authoritative movement, contact, and impact state', async ({ browser, baseURL }) => {
  test.setTimeout(300_000);
  const hostContext = await browser.newContext({ recordVideo: { dir: 'test-results/online-host' } }); const guestContext = await browser.newContext({ recordVideo: { dir: 'test-results/online-guest' } });
  const host = await hostContext.newPage(); const guest = await guestContext.newPage();
  try {
    const operator = await request.newContext({ extraHTTPHeaders: { Authorization: 'Bearer local-e2e-test-only' } });
    const provision = await operator.post('http://127.0.0.1:8787/api/rooms', { data: { ruleset: 'standard' } });
    expect(provision.status(), 'the isolated local Worker provisions a test room').toBe(201);
    const room = (await provision.json() as { data: { roomId: string; tickets: { role: string; ticket: string }[] } }).data;
    await operator.dispose();
    const inviteFor = (role: 'player1' | 'player2') => {
      const seat = room.tickets.find(candidate => candidate.role === role);
      if (!seat) throw new Error(`Missing local test ticket for ${role}`);
      return `${room.roomId}.${seat.ticket}`;
    };

    for (const page of [host, guest]) {
      await page.goto(baseURL ?? '/');
      await page.getByRole('button', { name: 'ENTER RINGFALL' }).click();
      await page.getByRole('button', { name: 'PLAY ONLINE' }).click();
    }

    await host.getByPlaceholder('PASTE PRIVATE INVITATION...').fill(inviteFor('player1'));
    await guest.getByPlaceholder('PASTE PRIVATE INVITATION...').fill(inviteFor('player2'));
    await Promise.all([
      host.getByRole('button', { name: 'JOIN MATCH' }).click(),
      guest.getByRole('button', { name: 'JOIN MATCH' }).click(),
    ]);
    await expect(host.getByText('PLAYER 2 (CHALLENGER)')).toBeVisible({ timeout: 20_000 });
    await expect(guest.getByText('PLAYER 1 (HOST)')).toBeVisible({ timeout: 20_000 });
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
    await host.bringToFront();
    await expect(hostCanvas).toHaveAttribute('data-simulation-ready', 'true', { timeout: 45000 });
    await expect(host.locator('html')).toHaveAttribute('data-game-input-ready', 'true');
    await guest.bringToFront();
    await expect(guestCanvas).toHaveAttribute('data-simulation-ready', 'true', { timeout: 45000 });
    await expect(guest.locator('html')).toHaveAttribute('data-game-input-ready', 'true');
    // Browser contexts are foreground-throttled one at a time. Restore host
    // visibility before expecting its rAF-driven physics clock to advance.
    await host.bringToFront();
    await expect.poll(async () => Number(await hostCanvas.getAttribute('data-physics-steps')), { timeout: 20_000 }).toBeGreaterThan(30);

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
    await expect.poll(async () => Number(await guest.getByRole('progressbar', { name: 'HEALTH', exact: true }).first().getAttribute('aria-valuenow'))).toBeLessThan(100);
    await host.screenshot({ path: 'test-results/online-host-contact.png' });
    await guest.screenshot({ path: 'test-results/online-guest-contact.png' });
    await expect(hostCanvas).toHaveAttribute('data-physics-emergency-resets', '0');
    await expect(guestCanvas).toHaveAttribute('data-physics-emergency-resets', '0');
    await guest.bringToFront();
    await guest.keyboard.press('Escape');
    await guest.getByRole('button', { name: 'QUIT TO MENU' }).click();
    await host.bringToFront();
    await expect(host.getByText('WINS BY FORFEIT', { exact: true })).toBeVisible({ timeout: 20000 });
    await host.screenshot({ path: 'test-results/online-forfeit.png' });
  } finally {
    await hostContext.close(); await guestContext.close();
  }
});
