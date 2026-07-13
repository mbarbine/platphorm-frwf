import { interactionGroups } from '@react-three/rapier';

export const COLLISION_GROUP = { arena: 0, player: 1, opponent: 2, props: 3, gripSensors: 4 } as const;

export const fighterCollisionGroups = (side: 'player' | 'opponent'): number => side === 'player'
  ? interactionGroups(COLLISION_GROUP.player, [COLLISION_GROUP.arena, COLLISION_GROUP.opponent, COLLISION_GROUP.props])
  : interactionGroups(COLLISION_GROUP.opponent, [COLLISION_GROUP.arena, COLLISION_GROUP.player, COLLISION_GROUP.props]);

export const arenaCollisionGroups = interactionGroups(COLLISION_GROUP.arena, [COLLISION_GROUP.player, COLLISION_GROUP.opponent, COLLISION_GROUP.props]);
export const propCollisionGroups = interactionGroups(COLLISION_GROUP.props, [COLLISION_GROUP.arena, COLLISION_GROUP.player, COLLISION_GROUP.opponent, COLLISION_GROUP.props]);
export const gripSensorGroups = (side: 'player' | 'opponent'): number => side === 'player'
  ? interactionGroups(COLLISION_GROUP.gripSensors, [COLLISION_GROUP.opponent])
  : interactionGroups(COLLISION_GROUP.gripSensors, [COLLISION_GROUP.player]);
