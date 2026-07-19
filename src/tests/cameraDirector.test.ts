import { describe, expect, it } from 'vitest';
import { BATTLE_ROYALE_CAMERA_FRAME, selectCameraShot, usesSteadyBattleRoyaleCamera } from '../game/camera/cameraDirector';

const base = {
  replayActive: false, middleX: 0, middleZ: 0, separation: 2,
  playerState: 'idle' as const, opponentState: 'idle' as const,
  playerMoveCategory: null, opponentMoveCategory: null, securedGrapple: false,
  playerAttackPhase: null, opponentAttackPhase: null, grapplePhase: null,
  tablePosition: { x: 0, z: -7.2 }, lastImpactKind: null,
};

describe('camera director', () => {
  it('defines one fixed arena-wide Battle Royale frame', () => {
    expect(BATTLE_ROYALE_CAMERA_FRAME).toEqual({ position: { x: 0, y: 13, z: 17.5 }, target: { x: 0, y: 2.25, z: 0 }, fov: 55 });
    expect(Object.isFrozen(BATTLE_ROYALE_CAMERA_FRAME)).toBe(true);
    expect(Object.isFrozen(BATTLE_ROYALE_CAMERA_FRAME.position)).toBe(true);
    expect(Object.isFrozen(BATTLE_ROYALE_CAMERA_FRAME.target)).toBe(true);
  });

  it('keeps Singles on the directed camera path', () => {
    expect(usesSteadyBattleRoyaleCamera('battle_royale')).toBe(true);
    expect(usesSteadyBattleRoyaleCamera('singles')).toBe(false);
  });

  it('prioritizes match storytelling shots without losing broad spatial coverage', () => {
    expect(selectCameraShot(base)).toBe('broadcast');
    expect(selectCameraShot({ ...base, separation: 8 })).toBe('wide');
    expect(selectCameraShot({ ...base, middleX: 7 })).toBe('ringside-x');
    expect(selectCameraShot({ ...base, middleZ: -6.6 })).toBe('table');
    expect(selectCameraShot({ ...base, tablePosition: null, middleZ: 6 })).toBe('ringside-z');
  });

  it('gives replay, staged grapples, corner setups, and aerial states deterministic priority', () => {
    expect(selectCameraShot({ ...base, replayActive: true, securedGrapple: true })).toBe('replay');
    expect(selectCameraShot({ ...base, securedGrapple: true, playerState: 'airborne' })).toBe('grapple');
    expect(selectCameraShot({ ...base, securedGrapple: true, grapplePhase: 'lift' })).toBe('slam');
    expect(selectCameraShot({ ...base, playerState: 'climbing' })).toBe('corner');
    expect(selectCameraShot({ ...base, playerState: 'airborne' })).toBe('aerial');
  });

  it('uses a concise contact shot throughout a close strike', () => {
    expect(selectCameraShot({ ...base, playerMoveCategory: 'heavy', playerAttackPhase: 'anticipation' })).toBe('strike');
    expect(selectCameraShot({ ...base, playerMoveCategory: 'heavy', playerAttackPhase: 'active' })).toBe('strike');
    expect(selectCameraShot({ ...base, playerMoveCategory: 'quick', playerAttackPhase: 'anticipation' })).toBe('broadcast');
    expect(selectCameraShot({ ...base, playerMoveCategory: 'quick', playerAttackPhase: 'active' })).toBe('strike');
    expect(selectCameraShot({ ...base, separation: 4, playerMoveCategory: 'heavy', playerAttackPhase: 'active' })).toBe('broadcast');
  });
});
