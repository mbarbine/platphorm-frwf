import { useEffect, useRef, useState } from 'react';
import type { FrameInput } from '../systems/combat';
import type { ControlDevice, GameCommand } from '../types/game';

const COMMAND_KEYS: Readonly<Record<string, GameCommand>> = { KeyJ: 'quick', KeyK: 'heavy', KeyL: 'grapple', Space: 'dodge', KeyE: 'interact', KeyF: 'context', KeyQ: 'taunt' };

export interface InputController {
  read: () => FrameInput;
  device: ControlDevice;
}

export const useGameInput = (onPause: () => void): InputController => {
  const keys = useRef(new Set<string>());
  const queued = useRef<GameCommand[]>([]);
  const previousButtons = useRef<boolean[]>([]);
  const [device, setDevice] = useState<ControlDevice>('keyboard');

  useEffect(() => {
    const down = (event: KeyboardEvent): void => {
      if (event.repeat && COMMAND_KEYS[event.code]) return;
      keys.current.add(event.code); setDevice('keyboard');
      const command = COMMAND_KEYS[event.code];
      if (command) { queued.current.push(command); event.preventDefault(); }
      if (event.code === 'Escape') onPause();
    };
    const up = (event: KeyboardEvent): void => { keys.current.delete(event.code); };
    const connected = (): void => setDevice('gamepad');
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('gamepadconnected', connected);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('gamepadconnected', connected); };
  }, [onPause]);

  const read = (): FrameInput => {
    const commands = [...queued.current]; queued.current.length = 0;
    let x = (keys.current.has('KeyD') ? 1 : 0) - (keys.current.has('KeyA') ? 1 : 0);
    let z = (keys.current.has('KeyS') ? 1 : 0) - (keys.current.has('KeyW') ? 1 : 0);
    let run = keys.current.has('ShiftLeft') || keys.current.has('ShiftRight');
    const gamepad = navigator.getGamepads?.()[0];
    if (gamepad) {
      const axisX = gamepad.axes[0] ?? 0; const axisY = gamepad.axes[1] ?? 0;
      if (Math.hypot(axisX, axisY) > .18) { x = axisX; z = axisY; setDevice('gamepad'); }
      run ||= (gamepad.buttons[7]?.value ?? 0) > .35;
      const mappings: readonly [number, GameCommand][] = [[2, 'quick'], [3, 'heavy'], [1, 'grapple'], [0, 'dodge'], [4, 'interact'], [5, 'taunt'], [11, 'context']];
      for (const [index, command] of mappings) {
        const pressed = gamepad.buttons[index]?.pressed ?? false;
        if (pressed && !previousButtons.current[index]) commands.push(command);
        previousButtons.current[index] = pressed;
      }
      if ((gamepad.buttons[9]?.pressed ?? false) && !previousButtons.current[9]) onPause();
      previousButtons.current[9] = gamepad.buttons[9]?.pressed ?? false;
    }
    return { move: { x, z }, run, commands };
  };
  return { read, device };
};
