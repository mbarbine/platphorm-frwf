import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createMatch } from '../game/systems/combat';

const captured = vi.hoisted(() => new Map<string, number[]>());
vi.mock('@react-three/rapier', () => ({
  RigidBody: ({ name, position }: { name: string; position: number[] }) => { captured.set(name, [...position]); return null; },
  BallCollider: () => null, CuboidCollider: () => null, CapsuleCollider: () => null,
  useSphericalJoint: () => null, useRevoluteJoint: () => null,
}));
vi.mock('../game/physics/physicsRuntime', () => ({ bodyWorksRuntime: { registerFighter: () => () => {} } }));
import { PhysicalFighterRig } from '../game/components/PhysicalFighterRig';

afterEach(() => { cleanup(); captured.clear(); });
describe('physical rig transform ownership', () => {
  it('does not reapply spawn transforms when React receives solved movement or a throw', () => {
    const model = createMatch('chad', 'vex', 'standard', 'normal');
    const view = render(React.createElement(PhysicalFighterRig, { runtime: model.player, side: 'player', showVisuals: false }));
    const spawn = new Map(captured);
    expect(spawn.size).toBe(16);
    model.player = { ...model.player, position: { x: 4, z: -2 }, state: 'airborne' };
    view.rerender(React.createElement(PhysicalFighterRig, { runtime: model.player, side: 'player', showVisuals: false }));
    expect(captured).toEqual(spawn);
    model.player = { ...model.player, position: { x: 1, z: 3 }, state: 'recovering' };
    view.rerender(React.createElement(PhysicalFighterRig, { runtime: model.player, side: 'player', showVisuals: false }));
    expect(captured).toEqual(spawn);
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
