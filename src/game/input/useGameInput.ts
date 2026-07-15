import { useCallback, useEffect, useRef, useState } from 'react';
import type { FrameInput } from '../systems/combat';
import type { ControlDevice, Vec2 } from '../types/game';
import {
  ActionEventCollector,
  GAMEPAD_BUTTON_ACTIONS,
  HeldActionTracker,
  KEYBOARD_ACTIONS,
  XR_BUTTON_ACTIONS,
  createActionEvent,
  isBufferedAction,
} from './actionLayer';
import type { ActionEvent, ActionSource } from './actionLayer';
import { mobileInput } from './mobileInput';

// Unified rescue grammar: WASD move · Shift sprint · J punch · K kick · L grapple
//                         I guard · Space dodge/counter · C jump · E prop · F context · Q taunt
const MOVEMENT_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'KeyI']);

export interface InputController {
  read: (xrSources?: readonly XRInputSource[]) => FrameInput;
  device: ControlDevice;
}

const keyboardDirection = (keys: ReadonlySet<string>): Vec2 => ({
  x: (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0),
  z: (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0),
});

export const readGamepadDirection = (gamepad: Gamepad): Vec2 => {
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

export const useGameInput = (onPause: () => void, enabled = true, onClear?: (reason: string) => void): InputController => {
  const keys = useRef(new Set<string>());
  const edgeEvents = useRef<ActionEventCollector | null>(null);
  const heldActions = useRef<HeldActionTracker | null>(null);
  if (!edgeEvents.current) edgeEvents.current = new ActionEventCollector();
  if (!heldActions.current) heldActions.current = new HeldActionTracker();
  const previousButtons = useRef<boolean[]>([]);
  const previousPausePressed = useRef(false);
  const previousXRButtons = useRef(new Map<string, boolean>());
  const actionReadCount = useRef(0);
  const enabledRef = useRef(enabled); enabledRef.current = enabled;
  const onPauseRef = useRef(onPause); onPauseRef.current = onPause;
  const onClearRef = useRef(onClear); onClearRef.current = onClear;
  const [device, setDevice] = useState<ControlDevice>('keyboard');

  const clearInputState = useCallback((reason: string): void => {
    keys.current.clear(); edgeEvents.current?.clear(); heldActions.current?.reset(); mobileInput.reset();
    const gamepad = navigator.getGamepads?.()[0];
    previousButtons.current = Array.from(gamepad?.buttons ?? [], (button) => button.pressed);
    previousPausePressed.current = gamepad?.buttons[9]?.pressed ?? false;
    previousXRButtons.current.clear();
    onClearRef.current?.(reason);
  }, []);

  useEffect(() => {
    const down = (event: KeyboardEvent): void => {
      const action = KEYBOARD_ACTIONS[event.code];
      if (event.repeat && action) return;
      if (action === 'pause') {
        onPauseRef.current(); event.preventDefault(); return;
      }
      if (!enabledRef.current) {
        if (action || MOVEMENT_KEYS.has(event.code)) event.preventDefault();
        return;
      }
      keys.current.add(event.code);
      setDevice('keyboard');
      if (action && isBufferedAction(action)) {
        edgeEvents.current?.push(createActionEvent(action, { source: 'keyboard', direction: keyboardDirection(keys.current) }));
      }
      if (action || MOVEMENT_KEYS.has(event.code)) event.preventDefault();
    };
    const up = (event: KeyboardEvent): void => { keys.current.delete(event.code); };
    const clear = (): void => clearInputState('focus lost');
    const visibility = (): void => { if (document.hidden) clearInputState('document hidden'); };
    const connected = (): void => setDevice('gamepad');
    const touchActivity = (): void => setDevice('touch');
    document.documentElement.dataset.gameInputReady = 'true';
    const unsubscribeTouch = mobileInput.subscribe(touchActivity);
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', clear); document.addEventListener('visibilitychange', visibility); window.addEventListener('gamepadconnected', connected);
    return () => { clearInputState('input controller unmounted'); unsubscribeTouch(); delete document.documentElement.dataset.gameInputReady; window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('gamepadconnected', connected); };
  }, [clearInputState]);

  useEffect(() => {
    let frame = 0;
    const pollPause = (): void => {
      const pressed = navigator.getGamepads?.()[0]?.buttons[9]?.pressed ?? false;
      if (pressed && !previousPausePressed.current) onPauseRef.current();
      previousPausePressed.current = pressed;
      frame = window.requestAnimationFrame(pollPause);
    };
    frame = window.requestAnimationFrame(pollPause);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!enabled) clearInputState('input disabled');
    else previousButtons.current = Array.from(navigator.getGamepads?.()[0]?.buttons ?? [], (button) => button.pressed);
  }, [clearInputState, enabled]);

  const read = (xrSources: readonly XRInputSource[] = []): FrameInput => {
    const gamepad = navigator.getGamepads?.()[0];
    if (!enabledRef.current) {
      previousButtons.current = Array.from(gamepad?.buttons ?? [], (button) => button.pressed);
      return { move: { x: 0, z: 0 }, run: false, block: false, actions: [], targetCycle: 0 };
    }
    const pausePressed = gamepad?.buttons[9]?.pressed ?? false;
    if (pausePressed && !previousPausePressed.current) {
      previousPausePressed.current = true;
      previousButtons.current = Array.from(gamepad?.buttons ?? [], (button) => button.pressed);
      onPauseRef.current();
      return { move: { x: 0, z: 0 }, run: false, block: false, actions: [], targetCycle: 0 };
    }
    if (!pausePressed) previousPausePressed.current = false;
    const actions: ActionEvent[] = edgeEvents.current?.drain() ?? [];
    let targetCycle = 0;
    const keyboardMove = keyboardDirection(keys.current);
    let x = keyboardMove.x; let z = keyboardMove.z;
    let run = keys.current.has('ShiftLeft') || keys.current.has('ShiftRight');
    let block = keys.current.has('KeyI');
    let heldSource: ActionSource = 'keyboard';
    if (gamepad) {
      const direction = readGamepadDirection(gamepad);
      if (Math.hypot(direction.x, direction.z) > .18) { x = direction.x; z = direction.z; heldSource = 'gamepad'; setDevice('gamepad'); }
      const gamepadRun = (gamepad.buttons[7]?.value ?? 0) > .35;
      const gamepadBlock = (gamepad.buttons[6]?.value ?? 0) > .35;
      if (gamepadRun || gamepadBlock) heldSource = 'gamepad';
      run ||= gamepadRun; block ||= gamepadBlock;
      for (const [index, action] of GAMEPAD_BUTTON_ACTIONS) {
        const pressed = gamepad.buttons[index]?.pressed ?? false;
        if (pressed && !previousButtons.current[index]) {
          actions.push(createActionEvent(action, { source: 'gamepad', direction: { x, z } }));
          setDevice('gamepad');
        }
        previousButtons.current[index] = pressed;
      }
      const targetPressed = gamepad.buttons[8]?.pressed ?? false;
      if (targetPressed && !previousButtons.current[8]) targetCycle = 1;
      previousButtons.current[8] = targetPressed;
    }
    if (xrSources.length > 0) {
      setDevice('gamepad');
      heldSource = 'xr';
      const sources = {
        left: xrSources.find((source) => source.handedness === 'left')?.gamepad,
        right: xrSources.find((source) => source.handedness === 'right')?.gamepad,
      };
      if (sources.left) {
        const direction = readGamepadDirection(sources.left); if (Math.hypot(direction.x, direction.z) > .12) { x = direction.x; z = direction.z; }
        run ||= (sources.left.buttons[0]?.value ?? 0) > .35; block ||= (sources.left.buttons[1]?.value ?? 0) > .35;
      }
      for (const [hand, index, action] of XR_BUTTON_ACTIONS) {
        const key = `${hand}:${index}`; const pressed = sources[hand]?.buttons[index]?.pressed ?? false; const previous = previousXRButtons.current.get(key) ?? false;
        if (pressed && !previous) actions.push(createActionEvent(action, { source: 'xr', direction: { x, z } }));
        previousXRButtons.current.set(key, pressed);
      }
    }
    const touch = mobileInput.read();
    if (touch.active) {
      setDevice('touch');
      x = touch.move.x; z = touch.move.z; run = touch.run; block = touch.block;
      heldActions.current?.reset();
      actions.push(...(touch.actions ?? []));
    } else {
      const direction = { x, z };
      const moveEvent = heldActions.current?.update('move', Math.hypot(x, z) > .08, heldSource, direction);
      const runEvent = heldActions.current?.update('run', run, heldSource, direction);
      const guardEvent = heldActions.current?.update('guard', block, heldSource, direction);
      if (moveEvent) actions.push(moveEvent);
      if (runEvent) actions.push(runEvent);
      if (guardEvent) actions.push(guardEvent);
    }
    const magnitude = Math.hypot(x, z);
    if (magnitude > 1) { x /= magnitude; z /= magnitude; }
    if (actions.length > 0) {
      actionReadCount.current += actions.length;
      const latest = actions[actions.length - 1];
      document.documentElement.dataset.inputActionCount = String(actionReadCount.current);
      document.documentElement.dataset.inputLastAction = latest?.action ?? '';
      document.documentElement.dataset.inputLastActionSource = latest?.source ?? '';
      document.documentElement.dataset.inputLastActionPhase = latest?.phase ?? '';
    }
    return { move: { x, z }, run, block, actions, targetCycle };
  };
  return { read, device };
};
