import { describe, expect, it } from 'vitest';
import { MOTOR_PROFILES, type MotorProfileId } from '../game/physics/motorProfiles';

const UPPER_BODY_DYNAMIC_PROFILES = new Set<MotorProfileId>([
  'neutral',
  'combat',
  'walking',
  'running',
  'braking',
  'jumpLoad',
  'landing',
  'victory',
]);

describe('physicsRuntime profile ID allocation performance', () => {
  it('produces identical boolean results for all motor profile IDs', () => {
    for (const id in MOTOR_PROFILES) {
      const profileId = id as MotorProfileId;
      const inlineResult = [
        'neutral',
        'combat',
        'walking',
        'running',
        'braking',
        'jumpLoad',
        'landing',
        'victory',
      ].includes(profileId);
      const setResult = UPPER_BODY_DYNAMIC_PROFILES.has(profileId);
      expect(setResult).toBe(inlineResult);
    }
  });

  it('benchmarks Set lookup against inline array allocation without a machine-specific timing gate', () => {
    const iterations = 1_000_000;
    const testProfiles: MotorProfileId[] = ['walking', 'clinch', 'combat', 'airborne', 'running', 'getUp'];

    const inlineStart = performance.now();
    let inlineHits = 0;
    for (let i = 0; i < iterations; i++) {
      const profileId = testProfiles[i % testProfiles.length] ?? 'walking';
      if (['neutral', 'combat', 'walking', 'running', 'braking', 'jumpLoad', 'landing', 'victory'].includes(profileId)) {
        inlineHits++;
      }
    }
    const inlineDuration = performance.now() - inlineStart;

    const setStart = performance.now();
    let setHits = 0;
    for (let i = 0; i < iterations; i++) {
      const profileId = testProfiles[i % testProfiles.length] ?? 'walking';
      if (UPPER_BODY_DYNAMIC_PROFILES.has(profileId)) {
        setHits++;
      }
    }
    const setDuration = performance.now() - setStart;

    expect(setHits).toBe(inlineHits);
    expect(Number.isFinite(setDuration)).toBe(true);
    expect(Number.isFinite(inlineDuration)).toBe(true);
  });

  it("benchmarks sequential iteration vs array mapping and spread concatenation in input processing", () => {
    const iterations = 1_000_000;
    const sampleInput = {
      move: { x: 0.5, z: -0.5 },
      run: false,
      block: false,
      actions: [
        { action: "quickStrike" as const, phase: "started" as const, sequence: 1, timestamp: 1000, direction: { x: 0.5, y: -0.5 }, source: "keyboard" as const },
      ],
      commands: ["heavy" as const],
    };

    const baselineStart = performance.now();
    let baselineProcessed = 0;
    for (let i = 0; i < iterations; i++) {
      const legacyEvents = (sampleInput.commands ?? []).map((command) => ({
        action: command === "heavy" ? "heavyStrike" : "quickStrike",
        phase: "started" as const,
        sequence: i,
        timestamp: 1000,
        direction: sampleInput.move,
        source: "replay" as const,
      }));
      for (const event of [...(sampleInput.actions ?? []), ...legacyEvents]) {
        if (event.phase === "started") {
          baselineProcessed++;
        }
      }
    }
    const baselineDuration = performance.now() - baselineStart;

    const optStart = performance.now();
    let optProcessed = 0;
    for (let i = 0; i < iterations; i++) {
      if (sampleInput.actions) {
        for (let j = 0; j < sampleInput.actions.length; j++) {
          const event = sampleInput.actions[j];
          if (event && event.phase === "started") {
            optProcessed++;
          }
        }
      }
      if (sampleInput.commands) {
        for (let j = 0; j < sampleInput.commands.length; j++) {
          const command = sampleInput.commands[j];
          if (!command) continue;
          const event = {
            action: command === "heavy" ? "heavyStrike" : "quickStrike",
            phase: "started" as const,
            sequence: i,
            timestamp: 1000,
            direction: sampleInput.move,
            source: "replay" as const,
          };
          if (event.phase === "started") {
            optProcessed++;
          }
        }
      }
    }
    const optDuration = performance.now() - optStart;

    console.log("\n--- BENCHMARK RESULTS (captureInput Iteration) ---");
    console.log(`Iterations: ${iterations.toLocaleString()}`);
    console.log(`Baseline (map + spread): ${baselineDuration.toFixed(2)} ms`);
    console.log(`Optimized (sequential): ${optDuration.toFixed(2)} ms`);
    console.log(`Speedup: ${(baselineDuration / optDuration).toFixed(2)}x (${((1 - optDuration / baselineDuration) * 100).toFixed(1)}% reduction)`);
    console.log("-------------------------\n");

    expect(optProcessed).toBe(baselineProcessed);
    expect(Number.isFinite(optDuration)).toBe(true);
  });
});
