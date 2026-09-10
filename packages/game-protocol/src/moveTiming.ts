/** Phase durations used by both online authority and the rendered moves. */
export const NETWORK_MOVE_TIMING = {
  jab: { anticipation: .14, active: .30, recovery: .2 },
  headbutt: { anticipation: .2, active: .36, recovery: .34 },
  low_kick: { anticipation: .18, active: .36, recovery: .3 },
  grapple_miss: { anticipation: .18, active: .26, recovery: .28 },
  slam: { anticipation: 1.08, active: .28, recovery: .54 },
} as const;

export function networkAnimationElapsed(moveId: string, phase: string | null, elapsed: number): number {
  const timing = NETWORK_MOVE_TIMING[moveId as keyof typeof NETWORK_MOVE_TIMING];
  if (!timing) return Math.max(0, elapsed);
  const offset = phase === 'active' ? timing.anticipation : phase === 'recovery' ? timing.anticipation + timing.active : 0;
  return offset + Math.max(0, elapsed);
}
