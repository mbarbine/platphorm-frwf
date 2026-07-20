import { interactionGroups } from '@react-three/rapier';
import type { FighterSlot } from '../types/game';

export const COLLISION_GROUP = { arena: 0, player: 1, opponent: 2, rival1: 3, rival2: 4, rival3: 5, props: 6, gripSensors: 7 } as const;
const FIGHTER_GROUPS = [COLLISION_GROUP.player, COLLISION_GROUP.opponent, COLLISION_GROUP.rival1, COLLISION_GROUP.rival2, COLLISION_GROUP.rival3] as const;

export const fighterCollisionGroups = (side: FighterSlot): number => interactionGroups(
  COLLISION_GROUP[side],
  [COLLISION_GROUP.arena, ...FIGHTER_GROUPS.filter((group) => group !== COLLISION_GROUP[side]), COLLISION_GROUP.props],
);

export const arenaCollisionGroups = interactionGroups(COLLISION_GROUP.arena, [...FIGHTER_GROUPS, COLLISION_GROUP.props]);
export const propCollisionGroups = interactionGroups(COLLISION_GROUP.props, [COLLISION_GROUP.arena, ...FIGHTER_GROUPS, COLLISION_GROUP.props]);
export const gripSensorGroups = (target: FighterSlot): number => interactionGroups(COLLISION_GROUP.gripSensors, [COLLISION_GROUP[target]]);
