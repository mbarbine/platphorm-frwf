/** Keep skin readable in venue light while adding a restrained perspiration sheen. */
export function skinRoughnessForEffort(base: number, stamina: number, staminaCap: number, active: boolean): number {
  const fatigue = staminaCap > 0 ? 1 - Math.max(0, Math.min(staminaCap, stamina)) / staminaCap : 0;
  const effort = Math.max(fatigue, active ? .22 : 0);
  return Math.max(.34, Math.min(.78, base - effort * .2));
}
