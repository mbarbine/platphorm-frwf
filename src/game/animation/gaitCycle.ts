/** The leg sweeps backward during support, then bends as the boot returns forward. */
export function gaitCycle(phase: number) {
  const support = Math.cos(phase);
  return { planted: support > .12, lift: Math.max(0, -support), supportWeight: Math.max(0, support) };
}
