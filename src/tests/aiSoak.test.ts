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
    console.info('[ai-soak]', JSON.stringify({ completed: report.completed, timedOut: report.timedOut, pinfalls: report.pinfalls, knockouts: report.knockouts, averageSimulatedSeconds: Number(report.averageSimulatedSeconds.toFixed(2)), averageStepMs: Number(report.averageStepMs.toFixed(4)), p95MatchWallMs: Number(report.p95MatchWallMs.toFixed(2)), maximumReplayFrames: report.maximumReplayFrames, maximumProps: report.maximumProps }));
  }, 30_000);

  it('completes Battle Royale bot matches with four real eliminations each', () => {
    const report = runAiSoak(10, 73_000, 480, 'battle_royale');
    expect(report.completed, JSON.stringify(report.matches.filter((match) => !match.completed))).toBe(10);
    expect(report.timedOut).toBe(0);
    expect(report.matches.every((match) => match.matchMode === 'battle_royale' && match.eliminations === 4)).toBe(true);
    expect(report.maximumReplayFrames).toBeLessThanOrEqual(75);
    expect(report.averageStepMs).toBeLessThan(7);
  }, 30_000);
});
