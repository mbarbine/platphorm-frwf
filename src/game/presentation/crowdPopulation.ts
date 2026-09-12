/** Reproducible fan groups: reloads preserve a crowd, changing the seed makes a new one. */
export function crowdPopulation(count: number, variants: number, seed = 9122026) {
  if (!Number.isFinite(count) || !Number.isInteger(variants) || variants < 1) return [];
  const target = Math.min(320, Math.max(0, Math.floor(count)));
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const fans = [];
  let seat = 0; let group = 0;
  while (fans.length < target) {
    const size = 3 + Math.floor(random() * 4);
    const energy = .5 + random() * .5;
    for (let member = 0; member < size && fans.length < target; member++, seat++) {
      const row = Math.floor(seat / 48); const angle = (seat % 48) / 48 * Math.PI * 2 + (row % 2) * .045;
      const radius = 13.9 + row * 1.28 + (random() - .5) * .14;
      fans.push({ group, variant: Math.floor(random() * variants), x: Math.cos(angle) * radius, z: Math.sin(angle) * radius,
        floor: .4 + row * .62, yaw: -angle - Math.PI / 2 + (random() - .5) * .22,
        height: .91 + random() * .17, width: .9 + random() * .2, phase: random() * Math.PI * 2, energy });
    }
    seat += 1 + Math.floor(random() * 2); group++;
  }
  return fans;
}
