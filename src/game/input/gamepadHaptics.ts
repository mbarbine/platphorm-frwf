import type { ImpactEvent } from '../types/game';

export interface HapticPattern { duration: number; strongMagnitude: number; weakMagnitude: number }

export const impactHapticPattern = (impact: Pick<ImpactEvent, 'kind' | 'intensity'>): HapticPattern => {
  const tier = impact.kind === 'finisher' || impact.kind === 'ko' || impact.kind === 'table' ? 1
    : impact.kind === 'grapple' || impact.kind === 'heavy' || impact.kind === 'weapon' ? .72
      : impact.kind === 'blocked' || impact.kind === 'counter' || impact.kind === 'rope' ? .46 : .28;
  const energy = Math.min(1, Math.max(.15, impact.intensity / 2.25));
  return {
    duration: Math.round(35 + tier * 145),
    strongMagnitude: Math.min(1, tier * energy),
    weakMagnitude: Math.min(1, (.3 + tier * .62) * energy),
  };
};

interface PlayEffectActuator {
  playEffect?: (type: 'dual-rumble', params: HapticPattern) => Promise<string>;
  pulse?: (value: number, duration: number) => Promise<boolean>;
}

export function pulseConnectedGamepads(impact: Pick<ImpactEvent, 'kind' | 'intensity'>): void {
  const pattern = impactHapticPattern(impact);
  for (const gamepad of navigator.getGamepads?.() ?? []) {
    if (!gamepad) continue;
    const actuator = (gamepad as Gamepad & { vibrationActuator?: PlayEffectActuator }).vibrationActuator;
    if (actuator?.playEffect) void actuator.playEffect('dual-rumble', pattern).catch(() => undefined);
    else if (actuator?.pulse) void actuator.pulse(Math.max(pattern.strongMagnitude, pattern.weakMagnitude), pattern.duration).catch(() => undefined);
  }
}
