import { describe, expect, it } from 'vitest';
import { createMatch, advanceMatch } from '../game/systems/combat';
import { chooseAiDecision } from '../game/ai/utilityAI';
import { fighterById } from '../game/data/fighters';

describe('normal singles breathing room', () => {
  it.each(['downed', 'recovering'] as const)('gives a healthy %s player room to regain control', (state) => {
    const model = createMatch('chad', 'vex', 'standard', 'normal');
    model.player.state = state; model.player.position = { x: 0, z: 0 };
    model.opponent.position = { x: 1.5, z: 0 }; model.elapsed = 15;
    for (let seed = 1; seed <= 100; seed++) {
      model.seed = seed * 237;
      const decision = chooseAiDecision(model, fighterById('vex'), 'opponent');
      expect(decision.command).toBeNull();
      expect(decision.move.x).toBeGreaterThan(0);
      expect(decision.run).toBe(false);
    }
  });
  it('keeps the opening interactive and releases the rival after two seconds', () => {
    const model = createMatch('chad', 'vex', 'standard', 'normal');
    const start = { ...model.opponent.position };
    for (let i=0;i<100;i++) advanceMatch(model,1/60,{ move:{x:0,z:1},run:false,block:false,commands:[] });
    expect(model.opponent.position).toEqual(start);
    expect(model.player.position.z).not.toBe(0);
    for (let i=0;i<100;i++) advanceMatch(model,1/60,{ move:{x:0,z:0},run:false,block:false,commands:[] });
    expect(model.opponent.position).not.toEqual(start);
  });
});
