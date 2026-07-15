import type { GameCommand, Vec2 } from '../types/game';
import type { ActionEvent, ActionPhase, ActionSource, GameAction } from '@frwf/game-protocol';
export type { ActionEvent, ActionPhase, ActionSource, GameAction } from '@frwf/game-protocol';

export interface CreateActionEventOptions {
  phase?: ActionPhase;
  sequence?: number;
  timestamp?: number;
  direction?: Vec2 | { x: number; y: number };
  source: ActionSource;
}

export const KEYBOARD_ACTIONS: Readonly<Record<string, GameAction>> = {
  KeyJ: 'quickStrike',
  KeyK: 'heavyStrike',
  KeyL: 'grapple',
  KeyI: 'guard',
  Space: 'dodgeCounter',
  KeyC: 'jump',
  KeyE: 'propAction',
  KeyF: 'contextAction',
  KeyQ: 'taunt',
  Escape: 'pause',
};

export const GAMEPAD_BUTTON_ACTIONS: readonly (readonly [number, GameAction])[] = [
  [2, 'quickStrike'],
  [3, 'heavyStrike'],
  [1, 'grapple'],
  [0, 'dodgeCounter'],
  [10, 'jump'],
  [4, 'propAction'],
  [5, 'taunt'],
  [11, 'contextAction'],
];

export const XR_BUTTON_ACTIONS: readonly (readonly ['left' | 'right', number, GameAction])[] = [
  ['right', 4, 'quickStrike'],
  ['right', 5, 'heavyStrike'],
  ['right', 1, 'grapple'],
  ['right', 3, 'dodgeCounter'],
  ['right', 0, 'contextAction'],
  ['left', 4, 'propAction'],
  ['left', 5, 'taunt'],
];

const ACTION_TO_COMMAND: Readonly<Partial<Record<GameAction, GameCommand>>> = {
  quickStrike: 'quick',
  heavyStrike: 'heavy',
  grapple: 'grapple',
  guard: 'block',
  dodgeCounter: 'dodge',
  jump: 'jump',
  propAction: 'interact',
  contextAction: 'context',
  taunt: 'taunt',
};

const COMMAND_TO_ACTION: Readonly<Record<GameCommand, GameAction>> = {
  quick: 'quickStrike',
  heavy: 'heavyStrike',
  grapple: 'grapple',
  block: 'guard',
  dodge: 'dodgeCounter',
  jump: 'jump',
  interact: 'propAction',
  context: 'contextAction',
  taunt: 'taunt',
};

let actionSequence = 0;

export const nextActionSequence = (): number => {
  actionSequence += 1;
  return actionSequence;
};

export const actionDirection = (direction: Vec2 | { x: number; y: number }): ActionEvent['direction'] => (
  'z' in direction ? { x: direction.x, y: direction.z } : { x: direction.x, y: direction.y }
);

export const actionDirectionToVec2 = (direction: ActionEvent['direction']): Vec2 => ({ x: direction.x, z: direction.y });

export const createActionEvent = (action: GameAction, options: CreateActionEventOptions): ActionEvent => ({
  action,
  phase: options.phase ?? 'started',
  sequence: options.sequence ?? nextActionSequence(),
  timestamp: options.timestamp ?? performance.now(),
  direction: actionDirection(options.direction ?? { x: 0, z: 0 }),
  source: options.source,
});

export const actionToGameCommand = (action: GameAction): GameCommand | null => ACTION_TO_COMMAND[action] ?? null;
export const gameCommandToAction = (command: GameCommand): GameAction => COMMAND_TO_ACTION[command];

export const isBufferedAction = (action: GameAction): boolean => !['move', 'run', 'guard', 'pause'].includes(action);

export const actionPriority = (action: GameAction): number => {
  if (action === 'pause') return 100;
  if (action === 'contextAction') return 90;
  if (action === 'propAction') return 85;
  if (action === 'dodgeCounter') return 80;
  if (action === 'grapple') return 70;
  if (action === 'quickStrike' || action === 'heavyStrike') return 60;
  if (action === 'jump') return 50;
  if (action === 'taunt') return 40;
  return 10;
};

/** A bounded edge collector, not a legality/TTL buffer. The simulation owns buffering. */
export class ActionEventCollector {
  private readonly pending: ActionEvent[] = [];

  constructor(private readonly capacity = 24) {}

  push(event: ActionEvent): void {
    this.pending.push(event);
    if (this.pending.length > this.capacity) this.pending.splice(0, this.pending.length - this.capacity);
  }

  drain(): ActionEvent[] {
    const events = this.pending.slice();
    this.pending.length = 0;
    return events;
  }

  clear(): void { this.pending.length = 0; }
}

interface HeldSnapshot {
  active: boolean;
  source: ActionSource;
}

/** Emits the same started/held/released lifecycle for continuous actions on every device. */
export class HeldActionTracker {
  private readonly previous = new Map<'move' | 'run' | 'guard', HeldSnapshot>();

  update(action: 'move' | 'run' | 'guard', active: boolean, source: ActionSource, direction: Vec2, timestamp = performance.now()): ActionEvent | null {
    const prior = this.previous.get(action);
    if (!active && !prior?.active) return null;
    const phase: ActionPhase = active ? prior?.active ? 'held' : 'started' : 'released';
    const event = createActionEvent(action, { phase, source: active ? source : prior?.source ?? source, direction, timestamp });
    this.previous.set(action, { active, source });
    return event;
  }

  reset(): void { this.previous.clear(); }
}
