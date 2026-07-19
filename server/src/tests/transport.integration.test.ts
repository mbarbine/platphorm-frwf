import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'colyseus';
import { Client as GameClient } from 'colyseus.js';
import { afterEach, describe, expect, it } from 'vitest';
import type { ActionEvent, CommandAckMessage, SnapshotMessage } from '@frwf/game-protocol';
import { PROTOCOL_VERSION } from '@frwf/game-protocol';
import { WrestlingRoom } from '../rooms/WrestlingRoom';

const waitFor = async (predicate: () => boolean, timeoutMs = 3_000): Promise<void> => {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error(`Timed out after ${timeoutMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};

describe('real Colyseus transport', () => {
  let gameServer: Server | null = null;

  afterEach(async () => {
    if (gameServer) await gameServer.gracefullyShutdown(false);
    gameServer = null;
  });

  it('carries two clients from ready state through authoritative collider contact', async () => {
    const httpServer = http.createServer();
    gameServer = new Server({ server: httpServer });
    gameServer.define('wrestling', WrestlingRoom, { ruleset: 'standard', difficulty: 'normal' });
    await gameServer.listen(0, '127.0.0.1');
    const port = (httpServer.address() as AddressInfo).port;
    const firstClient = new GameClient(`ws://127.0.0.1:${port}`); const secondClient = new GameClient(`ws://127.0.0.1:${port}`);
    const first = await firstClient.joinOrCreate('wrestling', { fighterId: 'atlas' });
    const second = await secondClient.joinById(first.id, { fighterId: 'nova' });
    const acknowledgements: CommandAckMessage[] = []; const snapshots: SnapshotMessage[] = []; const impacts: unknown[] = [];
    first.onMessage('commandAck', (message) => acknowledgements.push(message));
    first.onMessage('snapshot', (message) => snapshots.push(message));
    first.onMessage('impactEvent', (message) => impacts.push(message));
    first.onMessage('roomState', () => undefined);
    second.onMessage('snapshot', () => undefined);
    second.onMessage('impactEvent', () => undefined);
    second.onMessage('commandAck', () => undefined);
    second.onMessage('roomState', () => undefined);
    first.send('version', { clientVersion: PROTOCOL_VERSION }); second.send('version', { clientVersion: PROTOCOL_VERSION });
    first.send('ready', { protocolVersion: PROTOCOL_VERSION }); second.send('ready', { protocolVersion: PROTOCOL_VERSION });
    await waitFor(() => snapshots.length > 0);

    const event = (action: ActionEvent['action'], sequence: number, direction: ActionEvent['direction'], phase: ActionEvent['phase'] = 'started'): ActionEvent => ({ action, sequence, direction, phase, timestamp: performance.now(), source: 'network' });
    let movementSequence = 0;
    for (let burst = 0; burst < 12; burst += 1) {
      movementSequence += 1;
      const phase = burst === 0 ? 'started' : 'held';
      first.send('command', { seq: movementSequence, event: event('move', movementSequence, { x: 1, y: 0 }, phase), protocolVersion: PROTOCOL_VERSION });
      second.send('command', { seq: movementSequence, event: event('move', movementSequence, { x: -1, y: 0 }, phase), protocolVersion: PROTOCOL_VERSION });
      await new Promise((resolve) => setTimeout(resolve, 100));
      const latest = snapshots.at(-1); const p1 = latest?.fighters.find((fighter) => fighter.sessionId === first.sessionId); const p2 = latest?.fighters.find((fighter) => fighter.sessionId === second.sessionId);
      if (p1 && p2 && Math.hypot(p2.posX - p1.posX, p2.posZ - p1.posZ) < 1.2) break;
    }
    const contactRangeSnapshot = snapshots.at(-1); const rangeP1 = contactRangeSnapshot?.fighters.find((fighter) => fighter.sessionId === first.sessionId); const rangeP2 = contactRangeSnapshot?.fighters.find((fighter) => fighter.sessionId === second.sessionId);
    expect(rangeP1 && rangeP2 ? Math.hypot(rangeP2.posX - rangeP1.posX, rangeP2.posZ - rangeP1.posZ) : Number.POSITIVE_INFINITY).toBeLessThan(1.2);
    const releaseSequence = movementSequence + 1; const strikeSequence = releaseSequence + 1;
    first.send('command', { seq: releaseSequence, event: event('move', releaseSequence, { x: 0, y: 0 }, 'released'), protocolVersion: PROTOCOL_VERSION });
    second.send('command', { seq: releaseSequence, event: event('move', releaseSequence, { x: 0, y: 0 }, 'released'), protocolVersion: PROTOCOL_VERSION });
    first.send('command', { seq: strikeSequence, event: event('quickStrike', strikeSequence, { x: 0, y: 0 }), protocolVersion: PROTOCOL_VERSION });
    await waitFor(() => snapshots.some((snapshot) => (snapshot.fighters.find((fighter) => fighter.sessionId === second.sessionId)?.health ?? 100) < 100));

    const contactSnapshot = [...snapshots].reverse().find((snapshot) => (snapshot.fighters.find((fighter) => fighter.sessionId === second.sessionId)?.health ?? 100) < 100);
    expect(contactSnapshot?.fighters.find((fighter) => fighter.sessionId === first.sessionId)?.lastCommandSeq).toBe(strikeSequence);
    expect(acknowledgements).toContainEqual(expect.objectContaining({ seq: strikeSequence, accepted: true }));
    expect(impacts).toContainEqual(expect.objectContaining({ sourceSessionId: first.sessionId, targetSessionId: second.sessionId, moveId: 'jab' }));
    expect(contactSnapshot?.fighters.every((fighter) => Number.isFinite(fighter.posX) && Number.isFinite(fighter.posZ))).toBe(true);

    await Promise.all([first.leave(), second.leave()]);
  });
});
