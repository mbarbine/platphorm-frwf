import { beforeEach, describe, expect, it } from 'vitest';
import { activeFighterSlots, advanceMatch, createMatch, cyclePlayerTarget, resolveMatch } from '../game/systems/combat';
import { FIGHTER_SLOTS } from '../game/types/game';
import { liveSpectatorTargets, resolvedSpectatorTarget, useSpectatorStore } from '../game/state/spectatorStore';
import type { FrameInput } from '../game/systems/combat';

const noInput: FrameInput = { move: { x: 0, z: 0 }, run: false, block: false, commands: [] };

describe('battle royale rules', () => {
  beforeEach(() => useSpectatorStore.getState().reset());

  it('does not globally freeze unrelated wrestlers for overlapping impacts', () => {
    const model = createMatch('atlas', 'nova', 'standard', 'normal', 1337, 0, 0, 'battle_royale');
    model.elapsed = 3; model.hitStop = .3; model.slowMotion = .3;
    advanceMatch(model, .1, noInput);
    expect(model.elapsed).toBeGreaterThan(3.075);
    expect(model.hitStop).toBeCloseTo(.2);
  });

  it('starts with every roster member in the ring and no self-targets', () => {
    const model = createMatch('atlas', 'nova', 'standard', 'normal', 1337, 0, 0, 'battle_royale');
    const definitions = FIGHTER_SLOTS.map((slot) => model[slot].definitionId);
    const positions = FIGHTER_SLOTS.map((slot) => `${model[slot].position.x}:${model[slot].position.z}`);

    expect(model.matchMode).toBe('battle_royale');
    expect(activeFighterSlots(model)).toEqual(FIGHTER_SLOTS);
    expect(new Set(definitions).size).toBe(5);
    expect(new Set(positions).size).toBe(5);
    for (const slot of FIGHTER_SLOTS) expect(model.targets[slot]).not.toBe(slot);
  });

  it('turns a three-count into one elimination and lets the other four continue', () => {
    const model = createMatch('atlas', 'nova', 'standard', 'normal', 42, 0, 0, 'battle_royale');
    model.opponent.state = 'pinning'; model.opponent.position = { ...model.player.position };
    model.player.state = 'pinned'; model.player.health = 4; model.player.stamina = 0;

    advanceMatch(model, 3, noInput);

    expect(model.player.state).toBe('defeated');
    expect(model.eliminations).toEqual([{ fighter: 'player', by: 'opponent', method: 'PINFALL', time: 3 }]);
    expect(model.resolved).toBe(false);
    expect(FIGHTER_SLOTS.filter((slot) => model[slot].state !== 'defeated')).toHaveLength(4);
    for (const slot of FIGHTER_SLOTS.filter((candidate) => candidate !== 'player')) expect(model.targets[slot]).not.toBe('player');
  });

  it('resolves only after the fourth elimination leaves one wrestler standing', () => {
    const model = createMatch('atlas', 'nova', 'standard', 'hard', 91, 0, 0, 'battle_royale');

    resolveMatch(model, 'opponent', 'PINFALL', 'player');
    resolveMatch(model, 'rival1', 'KNOCKOUT', 'opponent');
    resolveMatch(model, 'rival2', 'PINFALL', 'rival1');
    expect(model.resolved).toBe(false);
    resolveMatch(model, 'rival3', 'KNOCKOUT', 'rival2');

    expect(model.eliminations).toHaveLength(4);
    expect(model.resolved).toBe(true);
    expect(model.result?.winner).toBe('rival3');
    expect(model.rival3.state).toBe('victorious');
  });

  it('cycles spectator targets only through wrestlers still fighting', () => {
    const model = createMatch('atlas', 'nova', 'standard', 'normal', 7, 0, 0, 'battle_royale');
    resolveMatch(model, 'opponent', 'PINFALL', 'player');
    resolveMatch(model, 'rival1', 'KNOCKOUT', 'opponent');
    const spectator = useSpectatorStore.getState();

    expect(liveSpectatorTargets(model)).toEqual(['rival1', 'rival2', 'rival3']);
    expect(resolvedSpectatorTarget(model, 'opponent')).toBe('rival1');
    spectator.setTarget('rival1'); spectator.cycleTarget(model);
    expect(useSpectatorStore.getState().target).toBe('rival2');
    useSpectatorStore.getState().setCameraMode('first_person');
    expect(useSpectatorStore.getState().cameraMode).toBe('first_person');
  });

  it('lets the player choose and temporarily lock a live target', () => {
    const model = createMatch('atlas', 'nova', 'standard', 'normal', 18, 0, 0, 'battle_royale');
    const originalTarget = model.targets.player;

    expect(cyclePlayerTarget(model)).toBe(true);
    expect(model.targets.player).not.toBe(originalTarget);
    expect(model.playerTargetLock).toBe(5);
    const lockedTarget = model.targets.player;
    model[lockedTarget].position = { x: 5.5, z: 3.8 };
    model[originalTarget].position = { x: model.player.position.x + .4, z: model.player.position.z };

    advanceMatch(model, .5, noInput);

    expect(model.targets.player).toBe(lockedTarget);
    expect(model.playerTargetLock).toBeCloseTo(4.5);
    expect(model.announcement).toContain('TARGET LOCK');
  });
});
