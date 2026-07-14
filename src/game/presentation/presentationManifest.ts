import { FIGHTERS } from '../data/fighters';
import { MOVES } from '../data/moves';
import type { FighterId, MoveDefinition } from '../types/game';
import type { ResolvedGraphicsTier } from '../runtime/quality';
import { fighterVisual } from './fighterVisuals';

export type FighterDetail = 'full' | 'standard' | 'reduced';

export const PRESENTATION_RIG_VERSION = 'ringfall-humanoid-rig-2.0.0';
export const SHARED_PRESENTATION_JOINTS = [
  'root', 'torso', 'head', 'leftUpperArm', 'leftForearm', 'rightUpperArm', 'rightForearm',
  'leftThigh', 'leftShin', 'rightThigh', 'rightShin',
] as const;

export const selectFighterDetail = (tier: ResolvedGraphicsTier, distance = 0): FighterDetail => {
  if (tier === 'quality' && distance < 14) return 'full';
  if (tier === 'performance' || distance > 22) return 'reduced';
  return 'standard';
};

export const movePresentationFamily = (move: MoveDefinition): string => {
  if (move.id === 'taunt') return 'fighter-signature-taunt';
  if (move.category === 'finisher') return 'fighter-signature-finisher';
  if (['slam', 'suplex', 'powerbomb', 'spinebuster', 'mountain_drop', 'skyhook', 'piledriver'].includes(move.id)) return `paired-lift-${move.id}`;
  if (move.category === 'grapple') return `paired-control-${move.id}`;
  if (move.category === 'aerial') return `aerial-${move.id}`;
  if (move.id === 'counter' || move.id === 'kick_up') return `utility-${move.id}`;
  return `strike-${move.id}`;
};

export const PRESENTATION_MANIFEST = {
  version: PRESENTATION_RIG_VERSION,
  joints: SHARED_PRESENTATION_JOINTS,
  fighters: FIGHTERS.map((fighter) => ({ id: fighter.id, visual: fighterVisual(fighter.id), finisher: fighter.signature, taunt: fighter.taunt })),
  moves: Object.values(MOVES).map((move) => ({ id: move.id, family: movePresentationFamily(move) })),
  fallback: 'mature-procedural-humanoid' as const,
  debugFallback: false,
} satisfies {
  version: string;
  joints: readonly string[];
  fighters: readonly { id: FighterId; visual: ReturnType<typeof fighterVisual>; finisher: string; taunt: string }[];
  moves: readonly { id: string; family: string }[];
  fallback: string;
  debugFallback: boolean;
};
