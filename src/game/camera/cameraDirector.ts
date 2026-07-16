import type { AttackPhase, FighterState, MatchMode } from '../types/game';

export type CameraShot = 'battle-royale-steady' | 'broadcast' | 'wide' | 'ringside-x' | 'ringside-z' | 'table' | 'strike' | 'grapple' | 'slam' | 'corner' | 'aerial' | 'replay';

/** One readable arena frame for active Battle Royale play. */
export const BATTLE_ROYALE_CAMERA_FRAME = Object.freeze({
  position: Object.freeze({ x: 0, y: 13, z: 17.5 }),
  target: Object.freeze({ x: 0, y: 2.25, z: 0 }),
  fov: 55,
});

export const usesSteadyBattleRoyaleCamera = (matchMode: MatchMode): boolean => matchMode === 'battle_royale';

export interface CameraDirectorContext {
  replayActive: boolean;
  middleX: number;
  middleZ: number;
  separation: number;
  playerState: FighterState;
  opponentState: FighterState;
  playerMoveCategory: string | null;
  opponentMoveCategory: string | null;
  playerAttackPhase: AttackPhase;
  opponentAttackPhase: AttackPhase;
  securedGrapple: boolean;
  grapplePhase: string | null;
  tablePosition: { x: number; z: number } | null;
  lastImpactKind: string | null;
}

const aerialState = (state: FighterState): boolean => state === 'climbing' || state === 'jumping' || state === 'airborne';

export function selectCameraShot(context: CameraDirectorContext): CameraShot {
  if (context.replayActive) return 'replay';
  if (context.securedGrapple && ['load', 'lift', 'release', 'impact'].includes(context.grapplePhase ?? '')) return 'slam';
  if (context.securedGrapple) return 'grapple';
  if (context.playerState === 'climbing' || context.opponentState === 'climbing') return 'corner';
  if (aerialState(context.playerState) || aerialState(context.opponentState) || context.playerMoveCategory === 'aerial' || context.opponentMoveCategory === 'aerial') return 'aerial';
  const activeStrike = (['anticipation', 'active'].includes(context.playerAttackPhase ?? '') && ['heavy', 'prop'].includes(context.playerMoveCategory ?? ''))
    || (['anticipation', 'active'].includes(context.opponentAttackPhase ?? '') && ['heavy', 'prop'].includes(context.opponentMoveCategory ?? ''));
  if (activeStrike && context.separation < 3.2) return 'strike';
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
  return shot === 'replay' || shot === 'slam' || shot === 'aerial' || shot === 'table' || shot === 'strike';
}
