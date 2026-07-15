import { describe, expect, it } from 'vitest';
import { fighterById } from '../game/data/fighters';
import { buildBodySchema } from '../game/physics/bodySchema';

describe('articulated fighter body schema', () => {
  it('uses a torso collider that matches committed chest-led contact', () => {
    const chest = buildBodySchema(fighterById('atlas')).find((segment) => segment.id === 'chest');
    expect(chest?.radius).toBeGreaterThanOrEqual(.3);
    expect(chest?.attackEligible).toBe(false);
  });
});
