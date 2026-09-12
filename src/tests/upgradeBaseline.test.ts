import { propReleaseVelocity } from '../game/physics/propHandling';
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createMatch, advanceMatch } from '../game/systems/combat';
import { KEYBOARD_ACTIONS, GAMEPAD_BUTTON_ACTIONS, GAMEPAD_HELD_ACTIONS } from '../game/input/actionLayer';
import { WORLD_ENCOUNTERS, canStandAt } from '../game/world/showground';
import { LAWNMOWER_ACTIVITY, nearLawnmower } from '../game/world/LawnmowerActivity';

describe('FRWF upgrade baseline', () => {
  it('keeps keyboard and controller action coverage aligned', () => {
    const controller = new Set(GAMEPAD_BUTTON_ACTIONS.map(([, action]) => action));
    controller.add('guard'); expect(GAMEPAD_HELD_ACTIONS.guard).toBe(6); expect(GAMEPAD_HELD_ACTIONS.sprint).toBe(7);
    for (const key of ['KeyJ', 'KeyK', 'KeyL', 'KeyI', 'Space', 'KeyC', 'KeyE', 'KeyF', 'KeyQ']) { const action = KEYBOARD_ACTIONS[key]; if (!action) throw new Error('Missing binding'); expect(controller.has(action)).toBe(true); }
  });
  it('drops without launching and throws in the requested direction', () => {
    expect(propReleaseVelocity(false, 0, { x: 0, y: 1, z: 0 })).toEqual({ x: 0, y: 0, z: 0 });
    const release = propReleaseVelocity(true, 0, { x: 0, y: 0, z: 0 }, { x: -1, z: 0 });
    expect(release.x).toBeLessThan(-7); expect(release.z).toBe(0); expect(release.y).toBeGreaterThan(0);
  });
  it('releases a weapon on knockdown without destroying it', () => {
    const model = createMatch('dale', 'britt', 'chaos', 'easy'); model.labMode = true;
    const chair = model.props.find(p => p.kind === 'chair'); if (!chair) throw new Error('Chair missing');
    model.player.heldPropId = chair.id; chair.heldBy = 'player'; model.player.state = 'downed';
    advanceMatch(model, 1 / 60, { move: { x: 0, z: 0 }, run: false, block: false, commands: [] });
    expect(model.player.heldPropId).toBeNull(); expect(chair.heldBy).toBeNull(); expect(chair.broken).toBe(false);
  });
  it('preserves every supplied archive image with matching hashes', () => {
    const entries = JSON.parse(readFileSync('public/archive/manifest.json', 'utf8')) as {url:string;sha256:string}[];
    expect(entries).toHaveLength(15);
    for (const entry of entries) { expect(existsSync(`public${entry.url}`)).toBe(true); expect(createHash('sha256').update(readFileSync(`public${entry.url}`)).digest('hex')).toBe(entry.sha256); }
  });
  it('offers new originals and a reachable fixed-destination mower activity', () => {
    for (const host of ['chelsea', 'britt', 'beer_bandit_bill', 'beer_bandit_ted']) expect(WORLD_ENCOUNTERS.some(e => e.host === host)).toBe(true);
    expect(LAWNMOWER_ACTIVITY.url).toBe('https://lawnmower.platphormnews.com');
    expect(nearLawnmower({ x: 4, z: 16 })).toBe(true); expect(canStandAt({ x: 4, z: 16 })).toBe(true); expect(nearLawnmower({ x: 0, z: 0 })).toBe(false);
  });
});
