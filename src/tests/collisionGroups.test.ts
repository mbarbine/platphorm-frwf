import { describe, expect, it } from 'vitest';
import {
  COLLISION_GROUP,
  arenaCollisionGroups,
  fighterCollisionGroups,
  gripSensorGroups,
  propCollisionGroups,
} from '../game/physics/collisionGroups';
import { FIGHTER_SLOTS, type FighterSlot } from '../game/types/game';

const getMembershipMask = (groups: number): number => (groups >> 16) & 0xffff;
const getFilterMask = (groups: number): number => groups & 0xffff;

describe('Collision groups bitmask definitions', () => {
  it('defines unique group indices in the valid Rapier group range [0, 15]', () => {
    const entries = Object.entries(COLLISION_GROUP);
    const indices = entries.map(([, val]) => val);
    const uniqueIndices = new Set(indices);

    expect(uniqueIndices.size).toBe(entries.length);
    for (const index of indices) {
      expect(Number.isInteger(index)).toBe(true);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThanOrEqual(15);
    }
  });

  it('generates correct membership and filter bitmasks for fighters', () => {
    for (const side of FIGHTER_SLOTS) {
      const groups = fighterCollisionGroups(side);
      const membership = getMembershipMask(groups);
      const filter = getFilterMask(groups);
      const expectedGroupBit = 1 << COLLISION_GROUP[side];

      // Membership bit should be set for the fighter's own group
      expect(membership).toBe(expectedGroupBit);

      // Filter bitmask should include arena and props
      expect(filter & (1 << COLLISION_GROUP.arena)).not.toBe(0);
      expect(filter & (1 << COLLISION_GROUP.props)).not.toBe(0);

      // Filter bitmask should exclude self (no self-collision)
      expect(filter & expectedGroupBit).toBe(0);

      // Filter bitmask should exclude grip sensors
      expect(filter & (1 << COLLISION_GROUP.gripSensors)).toBe(0);

      // Filter bitmask should include all other fighter slots
      for (const otherSide of FIGHTER_SLOTS) {
        if (otherSide !== side) {
          expect(filter & (1 << COLLISION_GROUP[otherSide])).not.toBe(0);
        }
      }
    }
  });

  it('generates correct bitmasks for arena colliders', () => {
    const membership = getMembershipMask(arenaCollisionGroups);
    const filter = getFilterMask(arenaCollisionGroups);

    expect(membership).toBe(1 << COLLISION_GROUP.arena);

    // Arena interacts with all fighters and props
    for (const side of FIGHTER_SLOTS) {
      expect(filter & (1 << COLLISION_GROUP[side])).not.toBe(0);
    }
    expect(filter & (1 << COLLISION_GROUP.props)).not.toBe(0);

    // Arena does not filter for grip sensors
    expect(filter & (1 << COLLISION_GROUP.gripSensors)).toBe(0);
  });

  it('generates correct bitmasks for prop colliders', () => {
    const membership = getMembershipMask(propCollisionGroups);
    const filter = getFilterMask(propCollisionGroups);

    expect(membership).toBe(1 << COLLISION_GROUP.props);

    // Props interact with arena, all fighters, and other props
    expect(filter & (1 << COLLISION_GROUP.arena)).not.toBe(0);
    for (const side of FIGHTER_SLOTS) {
      expect(filter & (1 << COLLISION_GROUP[side])).not.toBe(0);
    }
    expect(filter & (1 << COLLISION_GROUP.props)).not.toBe(0);

    // Props do not filter for grip sensors
    expect(filter & (1 << COLLISION_GROUP.gripSensors)).toBe(0);
  });

  it('generates target-isolated bitmasks for grip sensors', () => {
    for (const target of FIGHTER_SLOTS) {
      const groups = gripSensorGroups(target);
      const membership = getMembershipMask(groups);
      const filter = getFilterMask(groups);

      expect(membership).toBe(1 << COLLISION_GROUP.gripSensors);

      // Filter should include ONLY the target fighter slot
      expect(filter).toBe(1 << COLLISION_GROUP[target]);

      // Verify non-target slots are excluded
      for (const side of FIGHTER_SLOTS) {
        if (side !== target) {
          expect(filter & (1 << COLLISION_GROUP[side])).toBe(0);
        }
      }
      expect(filter & (1 << COLLISION_GROUP.arena)).toBe(0);
      expect(filter & (1 << COLLISION_GROUP.props)).toBe(0);
    }
  });

  it('maintains expected pairwise interaction rules', () => {
    // Fighters interact with each other (different slots)
    for (const slotA of FIGHTER_SLOTS) {
      for (const slotB of FIGHTER_SLOTS) {
        const groupsA = fighterCollisionGroups(slotA);
        const groupsB = fighterCollisionGroups(slotB);
        const memA = getMembershipMask(groupsA);
        const filterA = getFilterMask(groupsA);
        const memB = getMembershipMask(groupsB);
        const filterB = getFilterMask(groupsB);

        if (slotA === slotB) {
          // Self collision disabled
          expect((memA & filterB) !== 0 && (memB & filterA) !== 0).toBe(false);
        } else {
          // Cross-fighter collision enabled symmetrically
          expect((memA & filterB) !== 0).toBe(true);
          expect((memB & filterA) !== 0).toBe(true);
        }
      }
    }

    // Fighters interact with Arena and Props symmetrically
    for (const slot of FIGHTER_SLOTS) {
      const fighterGroups = fighterCollisionGroups(slot);
      const memF = getMembershipMask(fighterGroups);
      const filterF = getFilterMask(fighterGroups);

      const memArena = getMembershipMask(arenaCollisionGroups);
      const filterArena = getFilterMask(arenaCollisionGroups);
      expect((memF & filterArena) !== 0 && (memArena & filterF) !== 0).toBe(true);

      const memProp = getMembershipMask(propCollisionGroups);
      const filterProp = getFilterMask(propCollisionGroups);
      expect((memF & filterProp) !== 0 && (memProp & filterF) !== 0).toBe(true);
    }
  });
});
