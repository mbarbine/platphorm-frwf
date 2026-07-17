import { describe, expect, it } from 'vitest';
import { runAiSoak } from '../game/dev/aiSoak';

describe('bounded renderer-free AI intent soak', () => {
  it('never fabricates contact or match results without a physics world', () => {
    const report = runAiSoak(20, 57_000, 120);
    expect(report.completed).toBe(0);
    expect(report.timedOut).toBe(20);
    expect(report.pinfalls + report.knockouts).toBe(0);
    expect(report.matches.every((match) => Object.values(match.finalHealth).every((health) => health === 100))).toBe(true);
    expect(report.maximumReplayFrames).toBeLessThanOrEqual(75);
    expect(report.maximumProps).toBeLessThanOrEqual(12);
    expect(report.averageStepMs).toBeLessThan(4);
    expect(report.unknownFalls).toBe(0);
    expect(report.unstableWithoutCauseSeconds).toBe(0);
    expect(report.totalFalls).toBe(report.commandedFalls + report.impactFalls + report.throwFalls + report.fatigueFalls);
    console.info('[ai-soak]', JSON.stringify({ completed: report.completed, timedOut: report.timedOut, pinfalls: report.pinfalls, knockouts: report.knockouts, averageSimulatedSeconds: Number(report.averageSimulatedSeconds.toFixed(2)), averageStepMs: Number(report.averageStepMs.toFixed(4)), p95MatchWallMs: Number(report.p95MatchWallMs.toFixed(2)), maximumReplayFrames: report.maximumReplayFrames, maximumProps: report.maximumProps, totalFalls: report.totalFalls, commandedFalls: report.commandedFalls, impactFalls: report.impactFalls, throwFalls: report.throwFalls, fatigueFalls: report.fatigueFalls, unknownFalls: report.unknownFalls, unstableWithoutCauseSeconds: report.unstableWithoutCauseSeconds }));
  }, 30_000);

  it('never invents Battle Royale eliminations without solved contacts', () => {
    const report = runAiSoak(5, 73_000, 120, 'battle_royale');
    expect(report.completed).toBe(0);
    expect(report.timedOut).toBe(5);
    expect(report.matches.every((match) => match.matchMode === 'battle_royale' && match.eliminations === 0)).toBe(true);
    expect(report.matches.every((match) => Object.values(match.finalHealth).every((health) => health === 100))).toBe(true);
    expect(report.maximumReplayFrames).toBeLessThanOrEqual(75);
    expect(report.averageStepMs).toBeLessThan(7);
    expect(report.unknownFalls).toBe(0);
    expect(report.unstableWithoutCauseSeconds).toBe(0);
  }, 30_000);
});
