import type { ActionEvent, GameCommand, Vec2 } from '@frwf/game-protocol';
import type { OnlineFighterState, OnlineMatchState } from '../onlineSimulation.js';

export interface FrameInput {
  move: Vec2;
  run: boolean;
  block: boolean;
  actions?: readonly ActionEvent[];
  commands?: readonly GameCommand[];
}

export type MatchModel = OnlineMatchState;
export type FighterRuntime = OnlineFighterState;
