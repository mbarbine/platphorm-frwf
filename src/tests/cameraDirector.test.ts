import { describe, expect, it } from 'vitest';
import { selectCameraShot } from '../game/camera/cameraDirector';

const base = {
  replayActive: false, middleX: 0, middleZ: 0, separation: 2,
  playerState: 'idle' as const, opponentState: 'idle' as const,
  playerMoveCategory: null, opponentMoveCategory: null, securedGrapple: false,
  tablePosition: { x: 0, z: -7.2 }, lastImpactKind: null,
};

describe('camera director', () => {
  it('prioritizes match storytelling shots without losing broad spatial coverage', () => {
    expect(selectCameraShot(base)).toBe('broadcast');
    expect(selectCameraShot({ ...base, separation: 8 })).toBe('wide');
    expect(selectCameraShot({ ...base, middleX: 7 })).toBe('ringside-x');
    expect(selectCameraShot({ ...base, middleZ: -6.6 })).toBe('table');
    expect(selectCameraShot({ ...base, tablePosition: null, middleZ: 6 })).toBe('ringside-z');
  });

  it('gives replay, secured grapples, and aerial states deterministic priority', () => {
    expect(selectCameraShot({ ...base, replayActive: true, securedGrapple: true })).toBe('replay');
    expect(selectCameraShot({ ...base, securedGrapple: true, playerState: 'airborne' })).toBe('grapple');
    expect(selectCameraShot({ ...base, playerState: 'climbing' })).toBe('aerial');
  });
});
