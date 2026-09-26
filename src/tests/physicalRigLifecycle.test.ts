import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createMatch } from '../game/systems/combat';

const captured = vi.hoisted(() => new Map<string, number[]>());
const metadata = vi.hoisted(() => new Map<string, object>());
vi.mock('@react-three/rapier', () => ({
  interactionGroups: () => 0,
  RigidBody: ({ name, position, userData }: { name: string; position: number[]; userData: object }) => { captured.set(name, [...position]); metadata.set(name, userData); return null; },
  BallCollider: () => null, CuboidCollider: () => null, CapsuleCollider: () => null, RoundCuboidCollider: () => null,
  useSphericalJoint: () => null, useRevoluteJoint: () => null,
}));
vi.mock('../game/physics/physicsRuntime', () => ({ bodyWorksRuntime: { registerFighter: () => () => {} } }));
import { PhysicalFighterRig } from '../game/components/PhysicalFighterRig';

afterEach(() => { cleanup(); captured.clear(); metadata.clear(); });
describe('physical rig transform ownership', () => {
  it('does not reapply spawn transforms when React receives solved movement or a throw', () => {
    const model = createMatch('chad', 'vex', 'standard', 'normal');
    const view = render(React.createElement(PhysicalFighterRig, { runtime: model.player, side: 'player', showVisuals: false }));
    const spawn = new Map(captured);
    const spawnMetadata = new Map(metadata);
    expect(spawn.size).toBe(16);
    model.player = { ...model.player, position: { x: 4, z: -2 }, state: 'airborne' };
    view.rerender(React.createElement(PhysicalFighterRig, { runtime: model.player, side: 'player', showVisuals: false }));
    expect(captured).toEqual(spawn);
    for (const [name, data] of spawnMetadata) expect(metadata.get(name)).toBe(data);
    model.player = { ...model.player, position: { x: 1, z: 3 }, state: 'recovering' };
    view.rerender(React.createElement(PhysicalFighterRig, { runtime: model.player, side: 'player', showVisuals: false }));
    expect(captured).toEqual(spawn);
    for (const [name, data] of spawnMetadata) expect(metadata.get(name)).toBe(data);
  });
  it('uses the new spawn after a match remount', () => {
    const model = createMatch('chad', 'vex', 'standard', 'normal');
    const view = render(React.createElement(PhysicalFighterRig, { key: 1, runtime: model.player, side: 'player', showVisuals: false }));
    const original = captured.get('player-pelvis')?.[0] ?? 0;
    model.player.position.x += 2;
    view.rerender(React.createElement(PhysicalFighterRig, { key: 2, runtime: model.player, side: 'player', showVisuals: false }));
    expect(captured.get('player-pelvis')?.[0]).toBeCloseTo(original + 2);
  });
});
