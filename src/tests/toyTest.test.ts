import { describe, expect, it } from 'vitest';
import { advanceMatch, createMatch } from '../game/systems/combat';

describe('Toy Test control sandbox', () => {
  it('keeps AI passive so player body-control input remains isolated', () => {
    const model = createMatch('atlas', 'nova', 'standard', 'hard');
    model.toyTestMode = true;
    model.aiControllers.opponent.thinkTimer = 0;

    advanceMatch(model, .25, { move: { x: 0, z: 0 }, run: false, block: false, actions: [], commands: [] });

    expect(model.aiControllers.opponent).toMatchObject({ intent: null, movement: { x: 0, z: 0 }, running: false });
  });
});
