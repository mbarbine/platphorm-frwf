import { describe, expect, it } from 'vitest';
import { auditFallState, beginFall, fallCount } from '../game/systems/falls';
import { createMatch } from '../game/systems/combat';
import { FALL_REASONS } from '../game/types/game';

describe('fall cause audit', () => {
  it('records one explicit fall episode and retains its reason through recovery', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal');
    model.player.state = 'airborne'; beginFall(model, 'player', FALL_REASONS.Throw);
    auditFallState(model, 'player', 1 / 60); model.player.state = 'downed'; auditFallState(model, 'player', 1 / 60);
    model.player.state = 'recovering'; auditFallState(model, 'player', 1 / 60);
    expect(model.falls).toHaveLength(1); expect(model.player.fallReason).toBe(FALL_REASONS.Throw);
    expect(fallCount(model, FALL_REASONS.Throw)).toBe(1); expect(model.unstableWithoutCauseSeconds).toBe(0);
  });

  it('turns an unclassified fall into an explicit release failure', () => {
    const model = createMatch('atlas', 'vex', 'standard', 'normal');
    model.player.state = 'downed'; auditFallState(model, 'player', .25);
    expect(model.player.fallReason).toBe(FALL_REASONS.Unknown); expect(fallCount(model, FALL_REASONS.Unknown)).toBe(1);
    expect(model.unstableWithoutCauseSeconds).toBe(.25);
    model.player.state = 'idle'; auditFallState(model, 'player', 1 / 60);
    expect(model.player.fallReason).toBeNull(); expect(model.player.lastFallReason).toBe(FALL_REASONS.Unknown);
  });
});
