import { useEffect, useRef, useState } from 'react';
import type { FrameInput } from '../systems/combat';
import type { ControlDevice, GameCommand } from '../types/game';
import { mobileInput } from './mobileInput';

const COMMAND_KEYS: Readonly<Record<string, GameCommand>> = { KeyJ: 'quick', KeyK: 'heavy', KeyL: 'grapple', Space: 'dodge', KeyC: 'jump', KeyE: 'interact', KeyF: 'context', KeyQ: 'taunt' };
const MOVEMENT_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'KeyI']);

export interface InputController {
  read: (xrSources?: readonly XRInputSource[]) => FrameInput;
  device: ControlDevice;
}

export const readGamepadDirection = (gamepad: Gamepad): { x: number; z: number } => {
  const axes: readonly number[] = gamepad.axes ?? []; const buttons: readonly GamepadButton[] = gamepad.buttons ?? [];
  const first = { x: axes[0] ?? 0, z: axes[1] ?? 0 }; const second = { x: axes[2] ?? 0, z: axes[3] ?? 0 };
  const chosen = Math.hypot(second.x, second.z) > Math.hypot(first.x, first.z) ? second : first;
  const axisX = chosen.x; const axisY = chosen.z;
  const magnitude = Math.hypot(axisX, axisY);
  if (magnitude > .18) {
    const normalized = Math.min(1, (magnitude - .18) / .82);
    return { x: axisX / magnitude * normalized, z: axisY / magnitude * normalized };
  }
  return {
    x: (buttons[15]?.pressed ? 1 : 0) - (buttons[14]?.pressed ? 1 : 0),
    z: (buttons[13]?.pressed ? 1 : 0) - (buttons[12]?.pressed ? 1 : 0),
  };
};

export const useGameInput = (onPause: () => void): InputController => {
  const keys = useRef(new Set<string>());
  const queued = useRef<GameCommand[]>([]);
  const previousButtons = useRef<boolean[]>([]);
  const previousXRButtons = useRef(new Map<string, boolean>());
  const [device, setDevice] = useState<ControlDevice>('keyboard');

  useEffect(() => {
    const down = (event: KeyboardEvent): void => {
      if (event.repeat && COMMAND_KEYS[event.code]) return;
      keys.current.add(event.code); setDevice('keyboard');
      const command = COMMAND_KEYS[event.code];
      if (command) queued.current.push(command);
      if (command || MOVEMENT_KEYS.has(event.code)) event.preventDefault();
      if (event.code === 'Escape') onPause();
    };
    const up = (event: KeyboardEvent): void => { keys.current.delete(event.code); };
    const clear = (): void => { keys.current.clear(); mobileInput.reset(); };
    const visibility = (): void => { if (document.hidden) clear(); };
    const connected = (): void => setDevice('gamepad');
    const touchActivity = (): void => setDevice('touch');
    document.documentElement.dataset.gameInputReady = 'true';
    const unsubscribeTouch = mobileInput.subscribe(touchActivity);
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', clear); document.addEventListener('visibilitychange', visibility); window.addEventListener('gamepadconnected', connected);
    return () => { clear(); unsubscribeTouch(); delete document.documentElement.dataset.gameInputReady; window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('gamepadconnected', connected); };
  }, [onPause]);

  const read = (xrSources: readonly XRInputSource[] = []): FrameInput => {
    const commands = [...queued.current]; queued.current.length = 0;
    let x = (keys.current.has('KeyD') || keys.current.has('ArrowRight') ? 1 : 0) - (keys.current.has('KeyA') || keys.current.has('ArrowLeft') ? 1 : 0);
    let z = (keys.current.has('KeyS') || keys.current.has('ArrowDown') ? 1 : 0) - (keys.current.has('KeyW') || keys.current.has('ArrowUp') ? 1 : 0);
    let run = keys.current.has('ShiftLeft') || keys.current.has('ShiftRight');
    let block = keys.current.has('KeyI');
    const gamepad = navigator.getGamepads?.()[0];
    if (gamepad) {
      const direction = readGamepadDirection(gamepad);
      if (Math.hypot(direction.x, direction.z) > .18) { x = direction.x; z = direction.z; setDevice('gamepad'); }
      run ||= (gamepad.buttons[7]?.value ?? 0) > .35;
      block ||= (gamepad.buttons[6]?.value ?? 0) > .35;
      const mappings: readonly [number, GameCommand][] = [[2, 'quick'], [3, 'heavy'], [1, 'grapple'], [0, 'dodge'], [10, 'jump'], [4, 'interact'], [5, 'taunt'], [11, 'context']];
      for (const [index, command] of mappings) {
        const pressed = gamepad.buttons[index]?.pressed ?? false;
        if (pressed && !previousButtons.current[index]) commands.push(command);
        previousButtons.current[index] = pressed;
      }
      if ((gamepad.buttons[9]?.pressed ?? false) && !previousButtons.current[9]) onPause();
      previousButtons.current[9] = gamepad.buttons[9]?.pressed ?? false;
    }
    if (xrSources.length > 0) {
      setDevice('gamepad');
      const left = xrSources.find((source) => source.handedness === 'left')?.gamepad;
      const right = xrSources.find((source) => source.handedness === 'right')?.gamepad;
      if (left) {
        const direction = readGamepadDirection(left); if (Math.hypot(direction.x, direction.z) > .12) { x = direction.x; z = direction.z; }
        run ||= (left.buttons[0]?.value ?? 0) > .35; block ||= (left.buttons[1]?.value ?? 0) > .35;
      }
      const queueXR = (hand: 'left' | 'right', source: Gamepad | undefined, index: number, command: GameCommand): void => {
        const key = `${hand}:${index}`; const pressed = source?.buttons[index]?.pressed ?? false; const previous = previousXRButtons.current.get(key) ?? false;
        if (pressed && !previous) commands.push(command); previousXRButtons.current.set(key, pressed);
      };
      queueXR('right', right, 4, 'quick'); queueXR('right', right, 5, 'heavy'); queueXR('right', right, 1, 'grapple'); queueXR('right', right, 3, 'dodge'); queueXR('right', right, 0, 'context');
      queueXR('left', left, 4, 'interact'); queueXR('left', left, 5, 'taunt');
    }
    const touch = mobileInput.read();
    if (touch.active) {
      setDevice('touch');
      x = touch.move.x; z = touch.move.z; run = touch.run; block = touch.block;
    }
    commands.push(...touch.commands);
    const magnitude = Math.hypot(x, z);
    if (magnitude > 1) { x /= magnitude; z /= magnitude; }
    return { move: { x, z }, run, block, commands };
  };
  return { read, device };
};
