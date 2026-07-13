import { describe, expect, it } from 'vitest';
import { readGamepadDirection } from '../game/input/useGameInput';

const gamepadWithAxes = (axes: readonly number[]): Gamepad => ({ axes }) as unknown as Gamepad;

describe('desktop and XR gamepad normalization', () => {
  it('uses the active standard stick pair', () => {
    const direction = readGamepadDirection(gamepadWithAxes([.8, 0, 0, 0]));
    expect(direction.x).toBeGreaterThan(.7); expect(direction.z).toBe(0);
  });

  it('recognizes WebXR controllers that expose the thumbstick on axes two and three', () => {
    const direction = readGamepadDirection(gamepadWithAxes([0, 0, -.72, .54]));
    expect(direction.x).toBeLessThan(-.5); expect(direction.z).toBeGreaterThan(.35);
  });

  it('preserves the deadzone for resting controllers', () => {
    expect(readGamepadDirection(gamepadWithAxes([.08, -.06, .04, -.03]))).toEqual({ x: 0, z: 0 });
  });
});
