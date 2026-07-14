import type { FighterState } from '../types/game';

export type CameraShot = 'broadcast' | 'wide' | 'ringside-x' | 'ringside-z' | 'table' | 'aerial' | 'grapple' | 'replay';

export interface CameraDirectorContext {
  replayActive: boolean;
  middleX: number;
  middleZ: number;
  separation: number;
  playerState: FighterState;
  opponentState: FighterState;
  playerMoveCategory: string | null;
  opponentMoveCategory: string | null;
  securedGrapple: boolean;
  tablePosition: { x: number; z: number } | null;
  lastImpactKind: string | null;
}

const aerialState = (state: FighterState): boolean => state === 'climbing' || state === 'jumping' || state === 'airborne';

export function selectCameraShot(context: CameraDirectorContext): CameraShot {
  if (context.replayActive) return 'replay';
  if (context.securedGrapple) return 'grapple';
  if (aerialState(context.playerState) || aerialState(context.opponentState) || context.playerMoveCategory === 'aerial' || context.opponentMoveCategory === 'aerial') return 'aerial';
  if (context.tablePosition) {
    const tableDistance = Math.hypot(context.middleX - context.tablePosition.x, context.middleZ - context.tablePosition.z);
    if (tableDistance < 3.35 || context.lastImpactKind === 'table') return 'table';
  }
  if (Math.abs(context.middleZ) > 4.65) return 'ringside-z';
  if (Math.abs(context.middleX) > 6.1) return 'ringside-x';
  if (context.separation > 6.7) return 'wide';
  return 'broadcast';
}

export function cameraShotIsUrgent(shot: CameraShot): boolean {
  return shot === 'replay' || shot === 'grapple' || shot === 'aerial' || shot === 'table';
}
