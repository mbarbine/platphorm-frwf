/** Walks retain double support; running shortens stance as actual speed rises. */
export function gaitRunBlend(speed: number): number {
  const t = Math.max(0, Math.min(1, (speed - 2.8) / 2));
  return t * t * (3 - 2 * t);
}

export function gaitCycle(phase: number, run = 0) {
  const stance = .6 - Math.max(0, Math.min(1, run)) * .16;
  const cycle = ((phase / (Math.PI * 2) + stance / 2) % 1 + 1) % 1;
  const planted = cycle < stance;
  const progress = planted ? cycle / stance : (cycle - stance) / (1 - stance);
  // Constant rearward stance travel offsets forward body travel. Swing eases
  // into heel strike instead of snapping the knee straight on contact.
  const eased = progress * progress * (3 - 2 * progress);
  return {
    planted,
    travel: planted ? 1 - 2 * progress : -1 + 2 * eased,
    lift: planted ? 0 : Math.sin(progress * Math.PI) ** 2,
    supportWeight: planted ? Math.sin(progress * Math.PI) : 0,
  };
}
