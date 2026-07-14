export const BALANCE = {
  damageScale: .92,
  hypeScale: .55,
  stamina: {
    baseCap: 55,
    statScale: .45,
    beersPerFighter: 5,
    beerCapBoost: 5,
  },
  block: {
    holdDrainPerSecond: 2.2,
    strikeStaminaMultiplier: .72,
    chipDamageMultiplier: .12,
    grappleStaminaCost: 14,
    guardBreakStagger: .8,
  },
  ai: {
    earliestPinSeconds: 60,
    pinHealthThreshold: 62,
  },
  knockout: {
    earliestSeconds: 60,
    healthThreshold: 55,
    staminaThreshold: 15,
    minimumMoveDamage: 11,
  },
} as const;

export const BALANCE_RUBRIC = [
  { system: 'Match pace', target: '90–240 seconds with active defense', knobs: 'damageScale, recovery timing, pin gate' },
  { system: 'Stamina identity', target: 'Visible roster differences without input lockout', knobs: 'baseCap, statScale, recovery, move cost' },
  { system: 'Beer tradeoff', target: '0–5 visible pre-match choices; Chad reaches parity only after commitment', knobs: 'beersPerFighter, beerCapBoost' },
  { system: 'Guard', target: 'Reliable defense that loses to pressure and drains stamina', knobs: 'chip, hold drain, impact drain, guard break' },
  { system: 'Grapple readability', target: 'Lock, directional selection, lift, impact, safe release', knobs: 'anticipation, active, recovery, tether distance' },
  { system: 'Crowd Hype', target: 'Ordinary offense builds slowly; spectacle drives A/S ratings', knobs: 'hypeScale, variety decay, event bonuses' },
] as const;
