import { describe, expect, it } from 'vitest';
import { createMatch, resolveMatch } from '../game/systems/combat';
import { matchStanding } from '../ui/matchStanding';

describe('player match standing', () => {
  it('compares the current target without presenting crowd hype as a score', () => {
    const model = createMatch('chad', 'vex', 'standard', 'normal');
    model.hype = 100; model.player.health = 48; model.opponent.health = 82;
    expect(matchStanding(model)).toMatchObject({ health: 48, target: 82, label: 'HEALTH DISADVANTAGE', tone: 'behind' });
    model.opponent.health = 12;
    expect(matchStanding(model).label).toBe('HEALTH ADVANTAGE');
    expect(model.resolved).toBe(false);
  });
  it('prioritizes danger over a health lead and only calls a win when resolved', () => {
    const model = createMatch('chad', 'vex', 'standard', 'normal');
    model.player.health = 20; model.opponent.health = 1;
    expect(matchStanding(model).label).toBe('LOW HEALTH');
    resolveMatch(model, 'player', 'PINFALL');
    expect(matchStanding(model).label).toBe('YOU WIN');
  });
  it('tracks live elimination counts and a switched target in battle royale', () => {
    const model = createMatch('dale', 'chad', 'standard', 'normal', 1337, 0, 0, 'battle_royale');
    expect(matchStanding(model).remaining).toBe(5);
    resolveMatch(model, 'player', 'KNOCKOUT', 'opponent');
    model.targets.player = 'rival2'; model.rival2.health = 37;
    expect(matchStanding(model)).toMatchObject({ remaining: 4, target: 37, objective: '4 LEFT · LAST WRESTLER WINS' });
    resolveMatch(model, 'rival1', 'KNOCKOUT', 'player');
    expect(matchStanding(model).label).toBe('YOU ARE OUT');
  });
});
