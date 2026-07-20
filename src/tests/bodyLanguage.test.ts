import { describe, expect, it } from 'vitest';
import { bodyLanguageWeights } from '../game/animation/bodyLanguage';
import { createFighterRuntime } from '../game/systems/combat';

describe('wrestler body language', () => {
  it('reads neutral when healthy and fresh', () => {
    const fighter = createFighterRuntime('brick', { x: 0, z: 0 });
    expect(bodyLanguageWeights(fighter)).toEqual({ hurt: 0, exhausted: 0, dominant: 0 });
  });

  it('separates hurt, exhaustion, and dominance without relying on HUD color', () => {
    const hurt = createFighterRuntime('atlas', { x: 0, z: 0 }); hurt.health = 20;
    const exhausted = createFighterRuntime('vex', { x: 0, z: 0 }); exhausted.stamina = exhausted.staminaCap * .08;
    const dominant = createFighterRuntime('nova', { x: 0, z: 0 }); dominant.momentum = 100;
    expect(bodyLanguageWeights(hurt).hurt).toBeGreaterThan(.75);
    expect(bodyLanguageWeights(exhausted).exhausted).toBeGreaterThan(.85);
    expect(bodyLanguageWeights(dominant).dominant).toBe(1);
  });

  it('suppresses victory posture when the fighter is visibly distressed', () => {
    const fighter = createFighterRuntime('chad', { x: 0, z: 0 }); fighter.momentum = 100; fighter.health = 18;
    expect(bodyLanguageWeights(fighter).dominant).toBeLessThan(.25);
  });
});
