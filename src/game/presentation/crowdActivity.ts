export const CROWD_SIGNS = ['F THE BRICKS!', 'MARK IS IN CHARGE', 'MATT', 'TOM', 'FEAR THE CLAW', 'DALE! DALE! DALE!', 'THIS IS AWESOME', 'FRWF FOREVER'] as const;

/** Keep quiet spectators mixed with independent, intermittent reactions. */
export function fanArmAngles(time: number, phase: number, activity: number, prop: number, hype: number, reduced: boolean) {
  if (prop < .15) return { left: -2.75, right: 2.75 };
  if (prop < .22) return { left: 0, right: 2.55 };
  if (reduced || activity > .64) return { left: 0, right: 0 };
  const strength = 1.5 + Math.min(1, Math.max(0, hype)) * 1.1;
  // Independent short cheers avoid a crowd of synchronized, outstretched arms.
  const leftBurst = Math.max(0, Math.sin(time * (.5 + activity * .3) + phase));
  const rightBurst = Math.max(0, Math.sin(time * (.63 + activity * .21) + phase + 2.3));
  return { left: -(leftBurst ** 6) * strength, right: rightBurst ** 6 * strength };
}

/** A short entrance cue separated by long clear periods. */
export function fogBurstEnvelope(time: number) {
  const cycle = ((time % 55) + 55) % 55;
  return cycle < 8 ? Math.sin(cycle / 8 * Math.PI) ** 2 : 0;
}
