import { afterEach, describe, expect, it } from 'vitest';
import { useMatchStore } from '../game/state/matchStore';
import type { ClientFighterState } from '../game/multiplayer/ColyseusClient';
const snapshot = (patch: Partial<ClientFighterState> = {}): ClientFighterState => ({
  definitionId: 'atlas', health: 70, stamina: 60, momentum: 12, posX: -1, posZ: 0, facing: 1.57,
  velocityX: 0, velocityZ: 0, combatState: 'idle', moveId: '', attackPhase: '', phaseElapsed: 0,
  grappleTargetSessionId: null, pinCount: 0, finisherPrimed: false, lastCommandSeq: 1, ...patch,
});
afterEach(() => useMatchStore.getState().setNetworkAuthority(false));
describe('online presentation ownership', () => {
  it('converts the server phase clock and does not execute local gameplay between snapshots', () => {
    const store = useMatchStore.getState();
    store.configure('atlas', 'nova', 'standard', 'normal', 0, 0, 'singles');
    store.setNetworkAuthority(true);
    store.reconcileNetworkSnapshot(snapshot({ combatState: 'attacking', moveId: 'jab', attackPhase: 'active', phaseElapsed: .1 }), snapshot({ definitionId: 'nova', posX: 1 }), 2, 0, null);
    expect(useMatchStore.getState().model.player.phaseElapsed).toBeCloseTo(.24);
    store.advance(1 / 60, { move: { x: 0, z: 0 }, run: false, block: false, commands: ['heavy', 'grapple', 'context'] });
    const model = useMatchStore.getState().model;
    expect(model.player.moveId).toBe('jab');
    expect(model.player.stamina).toBe(60);
    expect(model.player.health).toBe(70);
    expect(model.opponent.health).toBe(70);
    expect(model.grapple).toBeNull();
    expect(model.player.phaseElapsed).toBeCloseTo(.24 + 1 / 60);
  });
});
