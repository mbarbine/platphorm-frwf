import type { FrameInput } from '../systems/combat';
import type { GameCommand, Vec2 } from '../types/game';

type ActivityListener = () => void;

const state: { move: Vec2; run: boolean; block: boolean; commands: GameCommand[]; lastActiveAt: number } = {
  move: { x: 0, z: 0 },
  run: false,
  block: false,
  commands: [],
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
  queue(command: GameCommand): void {
    state.commands.push(command);
    if (state.commands.length > 12) state.commands.splice(0, state.commands.length - 12);
    announceActivity();
  },
  read(): FrameInput & { active: boolean } {
    const commands = state.commands.splice(0);
    return {
      move: { ...state.move },
      run: state.run,
      block: state.block,
      commands,
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
    state.commands.length = 0;
    state.lastActiveAt = Number.NEGATIVE_INFINITY;
  },
  subscribe(listener: ActivityListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
