import { afterEach, expect, it, vi } from 'vitest';
import { mobileInput } from '../game/input/mobileInput';

afterEach(() => { mobileInput.reset(); vi.restoreAllMocks(); });
it.each(['movement', 'sprint', 'guard'])('keeps held %s active beyond the touch recency window', control => {
  let now = 100; vi.spyOn(performance, 'now').mockImplementation(() => now);
  if (control === 'movement') mobileInput.setMove({ x: 0, z: -1 });
  if (control === 'sprint') mobileInput.setRun(true);
  if (control === 'guard') mobileInput.setBlock(true);
  now += 15000;
  expect(mobileInput.read().active).toBe(true); expect(mobileInput.isActive()).toBe(true);
  mobileInput.setMove({ x: 0, z: 0 }); mobileInput.setRun(false); mobileInput.setBlock(false);
  now += 3000; expect(mobileInput.read().active).toBe(false);
});
it('clears held controls immediately on pause or focus-loss reset', () => {
  mobileInput.setMove({ x: 1, z: 0 }); mobileInput.setRun(true); mobileInput.setBlock(true);
  mobileInput.reset();
  expect(mobileInput.read()).toMatchObject({ move: { x: 0, z: 0 }, run: false, block: false, active: false });
});
