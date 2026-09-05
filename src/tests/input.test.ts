import { describe, expect, it } from 'vitest';
import { keyboardTargetCycle, primaryGamepad, readGamepadDirection } from '../game/input/useGameInput';
import { pulseConnectedGamepads } from '../game/input/gamepadHaptics';
import { mobileInput } from '../game/input/mobileInput';
import { vi } from 'vitest';

const gamepadWithAxes = (axes: readonly number[]): Gamepad => ({ axes }) as unknown as Gamepad;

describe('desktop and XR gamepad normalization', () => {
  it('turns Tab and Shift+Tab into authoritative target-cycle edges', () => {
    expect(keyboardTargetCycle('Tab')).toBe(1);
    expect(keyboardTargetCycle('Tab', true)).toBe(-1);
    expect(keyboardTargetCycle('KeyJ')).toBe(0);
  });

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

  it('uses a connected controller even when browser slot zero is empty', () => {
    const connected = { connected: true, buttons: [], axes: [] } as unknown as Gamepad;
    expect(primaryGamepad([null, connected])).toBe(connected);
  });
});

describe('mobileInput', () => {
  it('correctly tracks movement thresholds and queues actions', () => {
    mobileInput.reset();
    expect(mobileInput.isActive()).toBe(false);

    // Below 0.08 magnitude deadzone threshold
    mobileInput.setMove({ x: 0.05, z: 0.05 }); // magSq = 0.005 < 0.0064
    let frame = mobileInput.read();
    expect(frame.move).toEqual({ x: 0.05, z: 0.05 });
    expect(frame.actions.some((a) => a.action === 'move')).toBe(false);

    // Above 0.08 magnitude threshold
    mobileInput.setMove({ x: 0.1, z: 0.1 }); // magSq = 0.02 > 0.0064
    frame = mobileInput.read();
    expect(frame.actions.some((a) => a.action === 'move')).toBe(true);
    expect(mobileInput.isActive()).toBe(true);

    mobileInput.reset();
  });
});

describe('pulseConnectedGamepads', () => {
  it('swallows unhandled exceptions from playEffect', () => {
    const mockPlayEffect = vi.fn().mockRejectedValue(new Error('Haptic feedback failed'));
    vi.stubGlobal('navigator', {
      ...globalThis.navigator,
      getGamepads: () => [{
        vibrationActuator: {
          playEffect: mockPlayEffect
        }
      } as unknown as Gamepad]
    });

    expect(() => pulseConnectedGamepads({ kind: 'heavy', intensity: 10 })).not.toThrow();

    vi.unstubAllGlobals();
  });

  it('swallows unhandled exceptions from pulse', () => {
    const mockPulse = vi.fn().mockRejectedValue(new Error('Haptic feedback failed'));
    vi.stubGlobal('navigator', {
      ...globalThis.navigator,
      getGamepads: () => [{
        vibrationActuator: {
          pulse: mockPulse
        }
      } as unknown as Gamepad]
    });

    expect(() => pulseConnectedGamepads({ kind: 'heavy', intensity: 10 })).not.toThrow();

    vi.unstubAllGlobals();
  });
});
