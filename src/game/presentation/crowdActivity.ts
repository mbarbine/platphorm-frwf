export const CROWD_SIGNS = ['F THE BRICKS!', 'MARK IS IN CHARGE', 'MATT', 'TOM', 'FEAR THE CLAW', 'DALE! DALE! DALE!', 'THIS IS AWESOME', 'FRWF FOREVER'] as const;

export interface FanArmAngles { left: number; right: number }

/** Keep quiet spectators mixed with independent, intermittent reactions. */
// OPTIMIZATION: Optional `out` target object eliminates ~3,120 dynamic object allocations per second in 20Hz crowd update loops.
export function fanArmAngles(
  time: number,
  phase: number,
  activity: number,
  prop: number,
  hype: number,
  reduced: boolean,
  out: FanArmAngles = { left: 0, right: 0 },
): FanArmAngles {
  if (prop < .15) { out.left = -2.75; out.right = 2.75; return out; }
  if (prop < .22) { out.left = 0; out.right = 2.55; return out; }
  if (reduced || activity > .64) { out.left = 0; out.right = 0; return out; }
  const strength = 1.5 + Math.min(1, Math.max(0, hype)) * 1.1;
  // Independent short cheers avoid a crowd of synchronized, outstretched arms.
  const leftBurst = Math.max(0, Math.sin(time * (.5 + activity * .3) + phase));
  const rightBurst = Math.max(0, Math.sin(time * (.63 + activity * .21) + phase + 2.3));
  out.left = -(leftBurst ** 6) * strength;
  out.right = rightBurst ** 6 * strength;
  return out;
}

/** A short entrance cue separated by long clear periods. */
export function fogBurstEnvelope(time: number) {
  const cycle = ((time % 55) + 55) % 55;
  return cycle < 8 ? Math.sin(cycle / 8 * Math.PI) ** 2 : 0;
}
