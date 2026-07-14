import { describe, expect, it } from 'vitest';
import { runAiSoak } from '../game/dev/aiSoak';

describe('bounded AI match soak', () => {
  it('completes 50 deterministic bot matches without unbounded match state', () => {
    const report = runAiSoak(50, 57_000, 240);
    expect(report.completed).toBe(50);
    expect(report.timedOut).toBe(0);
    expect(report.pinfalls + report.knockouts).toBe(50);
    expect(report.maximumReplayFrames).toBeLessThanOrEqual(75);
    expect(report.maximumProps).toBeLessThanOrEqual(12);
    expect(report.averageStepMs).toBeLessThan(4);
  }, 30_000);
});

