import { describe, expect, it } from 'vitest';
import { fighterById } from '../game/data/fighters';
import { BODY_SEGMENT_COUNT, buildBodySchema } from '../game/physics/bodySchema';

describe('articulated fighter body schema', () => {
  it('keeps the runtime registration count aligned with the canonical schema', () => {
    expect(buildBodySchema(fighterById('atlas'))).toHaveLength(BODY_SEGMENT_COUNT);
  });

  it('uses a torso collider that matches committed chest-led contact', () => {
    const chest = buildBodySchema(fighterById('atlas')).find((segment) => segment.id === 'chest');
    expect(chest?.radius).toBeGreaterThanOrEqual(.3);
    expect(chest?.attackEligible).toBe(false);
  });
});
