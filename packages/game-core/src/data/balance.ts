// Pure balance constants — mirrors src/game/data/balance.ts.
export const BALANCE = {
  damageScale: .92,
  hypeScale: .55,
  stamina: { baseCap: 55, statScale: .45, beersPerFighter: 5, beerCapBoost: 5 },
  block: { holdDrainPerSecond: 2.2, strikeStaminaMultiplier: .72, chipDamageMultiplier: .12, grappleStaminaCost: 14, guardBreakStagger: .8 },
  ai: { earliestPinSeconds: 60, pinHealthThreshold: 62 },
  knockout: { earliestSeconds: 60, healthThreshold: 55, staminaThreshold: 15, minimumMoveDamage: 11 },
} as const;
