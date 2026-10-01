import type { ImpactEvent } from '../types/game';

export interface HapticPattern { duration: number; strongMagnitude: number; weakMagnitude: number }

export const impactHapticPattern = (impact: Pick<ImpactEvent, 'kind' | 'intensity'>): HapticPattern => {
  const tier = impact.kind === 'finisher' || impact.kind === 'ko' || impact.kind === 'table' ? 1
    : impact.kind === 'grapple' || impact.kind === 'heavy' || impact.kind === 'weapon' ? .82
      : impact.kind === 'blocked' || impact.kind === 'counter' || impact.kind === 'rope' ? .52 : .35;
  const energy = Math.min(1, Math.max(.20, impact.intensity / 2.0));
  return {
    duration: Math.round(45 + tier * 165),
    strongMagnitude: Math.min(1, tier * energy * 1.15),
    weakMagnitude: Math.min(1, (.35 + tier * .65) * energy * 1.15),
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
