import { describe, expect, it } from 'vitest';
import { MOVES } from '../game/data/moves';

const HEAVY_STRIKE_MOVES = new Set(['heavy', 'uppercut', 'stiff_arm', 'rebound']);

describe('motorProfiles move ID check allocation performance', () => {
  it('produces identical boolean results for all registered game move IDs', () => {
    for (const moveId in MOVES) {
      const chainedResult = moveId === 'heavy' || moveId === 'uppercut' || moveId === 'stiff_arm' || moveId === 'rebound';
      const setResult = HEAVY_STRIKE_MOVES.has(moveId);
      expect(setResult).toBe(chainedResult);
    }
  });

  it('benchmarks Set lookup against chained checks without a machine-specific timing gate', () => {
    const iterations = 1_000_000;
    const allMoveIds = Object.keys(MOVES);

    const chainedStart = performance.now();
    let chainedHits = 0;
    for (let i = 0; i < iterations; i++) {
      const moveId = allMoveIds[i % allMoveIds.length] ?? 'heavy';
      if (moveId === 'heavy' || moveId === 'uppercut' || moveId === 'stiff_arm' || moveId === 'rebound') {
        chainedHits++;
      }
    }
    const chainedDuration = performance.now() - chainedStart;

    const setStart = performance.now();
    let setHits = 0;
    for (let i = 0; i < iterations; i++) {
      const moveId = allMoveIds[i % allMoveIds.length] ?? 'heavy';
      if (HEAVY_STRIKE_MOVES.has(moveId)) {
        setHits++;
      }
    }
    const setDuration = performance.now() - setStart;

    expect(setHits).toBe(chainedHits);
    expect(Number.isFinite(setDuration)).toBe(true);
    expect(Number.isFinite(chainedDuration)).toBe(true);
  });

  it('verifies for...in iteration produces identical results to Object.keys for motor chain tuning', () => {
    type MotorChain = 'core' | 'head' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg' | 'hands' | 'feet';
    const base: Record<MotorChain, { stiffness: number; damping: number; maximumTorque: number; strength: number }> = {
      core: { stiffness: 255, damping: 44, maximumTorque: 275, strength: 1 },
      head: { stiffness: 120, damping: 20, maximumTorque: 88, strength: 1 },
      leftArm: { stiffness: 132, damping: 32, maximumTorque: 285, strength: 1 },
      rightArm: { stiffness: 132, damping: 32, maximumTorque: 285, strength: 1 },
      leftLeg: { stiffness: 170, damping: 31, maximumTorque: 168, strength: 1 },
      rightLeg: { stiffness: 170, damping: 31, maximumTorque: 168, strength: 1 },
      hands: { stiffness: 68, damping: 16, maximumTorque: 96, strength: 1 },
      feet: { stiffness: 92, damping: 18, maximumTorque: 74, strength: 1 },
    };

    const keysResult: Record<string, number> = {};
    for (const name of Object.keys(base) as MotorChain[]) {
      keysResult[name] = base[name].stiffness;
    }

    const forInResult: Record<string, number> = {};
    for (const name in base) {
      forInResult[name] = base[name as MotorChain].stiffness;
    }

    expect(forInResult).toEqual(keysResult);
  });
});
