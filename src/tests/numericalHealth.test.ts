import { describe, expect, it } from 'vitest';
import { inspectNumericalBody, jointSeparationFault } from '../game/physics/numericalHealth';

const sample = () => ({ segment: 'pelvis' as const, position: { x: 0, y: 3, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, linearVelocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 } });

describe('BodyWorks numerical health', () => {
  it('accepts a finite human-scale body sample', () => expect(inspectNumericalBody(sample())).toBeNull());
  it('detects non-finite, runaway, floor, arena, and joint faults deterministically', () => {
    expect(inspectNumericalBody({ ...sample(), position: { x: Number.NaN, y: 3, z: 0 } })?.code).toBe('non-finite');
    expect(inspectNumericalBody({ ...sample(), linearVelocity: { x: 25, y: 0, z: 0 } })?.code).toBe('linear-runaway');
    expect(inspectNumericalBody({ ...sample(), angularVelocity: { x: 0, y: 33, z: 0 } })?.code).toBe('angular-runaway');
    expect(inspectNumericalBody({ ...sample(), position: { x: 0, y: -4, z: 0 } })?.code).toBe('below-world');
    expect(inspectNumericalBody({ ...sample(), position: { x: 19, y: 3, z: 0 } })?.code).toBe('outside-arena');
    expect(jointSeparationFault('leftHand', .4, .83)?.code).toBe('joint-separation');
    expect(jointSeparationFault('leftHand', .4, .81)).toBeNull();
  });
});
