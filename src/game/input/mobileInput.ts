import type { FrameInput } from '../systems/combat';
import type { Vec2 } from '../types/game';
import { ActionEventCollector, HeldActionTracker, createActionEvent } from './actionLayer';
import type { GameAction } from './actionLayer';

type ActivityListener = () => void;

const state: { move: Vec2; run: boolean; block: boolean; actions: ActionEventCollector; held: HeldActionTracker; lastActiveAt: number } = {
  move: { x: 0, z: 0 },
  run: false,
  block: false,
  actions: new ActionEventCollector(16),
  held: new HeldActionTracker(),
  lastActiveAt: Number.NEGATIVE_INFINITY,
};

const listeners = new Set<ActivityListener>();
const announceActivity = (): void => {
  state.lastActiveAt = performance.now();
  for (const listener of listeners) listener();
};

export const mobileInput = {
  setMove(move: Vec2): void {
    state.move.x = move.x;
    state.move.z = move.z;
    announceActivity();
  },
  setRun(run: boolean): void {
    state.run = run;
    announceActivity();
  },
  setBlock(block: boolean): void {
    state.block = block;
    announceActivity();
  },
  queue(action: GameAction): void {
    state.actions.push(createActionEvent(action, { source: 'touch', direction: state.move }));
    announceActivity();
  },
  read(): FrameInput & { active: boolean } {
    const actions = state.actions.drain();
    const timestamp = performance.now();
    const moveEvent = state.held.update('move', Math.hypot(state.move.x, state.move.z) > .08, 'touch', state.move, timestamp);
    const runEvent = state.held.update('run', state.run, 'touch', state.move, timestamp);
    const guardEvent = state.held.update('guard', state.block, 'touch', state.move, timestamp);
    if (moveEvent) actions.push(moveEvent);
    if (runEvent) actions.push(runEvent);
    if (guardEvent) actions.push(guardEvent);
    return {
      move: { ...state.move },
      run: state.run,
      block: state.block,
      actions,
      active: performance.now() - state.lastActiveAt < 2_500,
    };
  },
  isActive(): boolean {
    return performance.now() - state.lastActiveAt < 2_500;
  },
  reset(): void {
    state.move.x = 0;
    state.move.z = 0;
    state.run = false;
    state.block = false;
    state.actions.clear();
    state.held.reset();
    state.lastActiveAt = Number.NEGATIVE_INFINITY;
  },
  subscribe(listener: ActivityListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
