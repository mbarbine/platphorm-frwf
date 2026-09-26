import { Euler, Quaternion } from 'three';
import data from './generated/combat-motions.json';
import type { Pose } from './poses';
import type { AttackPhase, MoveDefinition } from '../types/game';

interface MotionClip { duration: number; contact: number | null; frames: { time: number; pose: Pose }[] }
const clips = data.clips as unknown as Record<string, MotionClip>;
const clamp = (n: number, low = 0, high = 1) => Math.max(low, Math.min(high, n));
// OPTIMIZATION: Module-level static constant eliminates inline array allocations in hot frame loops.
const SIDES = ['left', 'right'] as const;
const qa = new Quaternion(); const qb = new Quaternion(); const ea = new Euler(); const eb = new Euler();

/** OPTIMIZATION: Helper function for shortest-arc quaternion slerp on 3D Euler joints. */
function slerpJoint(ak: readonly [number, number, number], bk: readonly [number, number, number], amount: number): [number, number, number] {
  qa.setFromEuler(ea.set(ak[0], ak[1], ak[2]));
  qb.setFromEuler(eb.set(bk[0], bk[1], bk[2]));
  ea.setFromQuaternion(qa.slerp(qb, amount));
  return [ea.x, ea.y, ea.z];
}

/** Shortest-arc interpolation avoids Euler wrap snaps in imported shoulder motion.
 * OPTIMIZATION: Direct unrolled Pose property construction avoids `for...of` array iterations and redundant `{ ...a }` initial object shallow cloning.
 */
function blend(a: Pose, b: Pose, amount: number): Pose {
  const alf = a.leftForearm; const blf = b.leftForearm;
  const arf = a.rightForearm; const brf = b.rightForearm;
  const als = a.leftShin; const bls = b.leftShin;
  const ars = a.rightShin; const brs = b.rightShin;
  return {
    torso: slerpJoint(a.torso, b.torso, amount),
    leftArm: slerpJoint(a.leftArm, b.leftArm, amount),
    rightArm: slerpJoint(a.rightArm, b.rightArm, amount),
    leftForearm: [alf[0] + (blf[0] - alf[0]) * amount, 0, 0],
    rightForearm: [arf[0] + (brf[0] - arf[0]) * amount, 0, 0],
    leftLeg: slerpJoint(a.leftLeg, b.leftLeg, amount),
    rightLeg: slerpJoint(a.rightLeg, b.rightLeg, amount),
    leftShin: [als[0] + (bls[0] - als[0]) * amount, 0, 0],
    rightShin: [ars[0] + (brs[0] - ars[0]) * amount, 0, 0],
    rootX: a.rootX + (b.rootX - a.rootX) * amount,
    rootY: a.rootY + (b.rootY - a.rootY) * amount,
    rootZ: a.rootZ + (b.rootZ - a.rootZ) * amount,
    rootTilt: a.rootTilt + (b.rootTilt - a.rootTilt) * amount,
    rootYaw: a.rootYaw + (b.rootYaw - a.rootYaw) * amount,
    rootRoll: a.rootRoll + (b.rootRoll - a.rootRoll) * amount,
  };
}

export function sampleCombatMotion(id: string, seconds: number): Pose | null {
  const clip = clips[id]; if (!clip) return null;
  const t = clamp(seconds, 0, clip.duration);
  const index = Math.min(clip.frames.length - 2, Math.floor(t * 30));
  const a = clip.frames[index]; const b = clip.frames[index + 1];
  if (!a || !b) return null;
  return blend(a.pose, b.pose, clamp((t - a.time) / Math.max(.0001, b.time - a.time)));
}

export function authoredStrikePose(base: Pose, move: MoveDefinition, phase: AttackPhase, elapsed: number): Pose {
  const clip = clips[move.id]; if (!clip || clip.contact === null) return base;
  const loadEnd = Math.max(0, clip.contact - .1);
  const strikeEnd = Math.min(clip.duration, clip.contact + .06);
  const progress = phase === 'anticipation' ? clamp(elapsed / move.anticipationDuration)
    : phase === 'active' ? clamp((elapsed - move.anticipationDuration) / move.activeDuration)
      : clamp((elapsed - move.anticipationDuration - move.activeDuration) / move.recoveryDuration);
  const time = phase === 'anticipation' ? progress * loadEnd
    : phase === 'active' ? loadEnd + progress * (strikeEnd - loadEnd)
      : strikeEnd + progress * (clip.duration - strikeEnd);
  const captured = sampleCombatMotion(move.id, time); if (!captured) return base;
  // Rapier owns foot placement and root travel. Captured hip/shoulder timing
  // drives the same physical limbs that score contact, never a separate skin.
  const envelope = phase === 'anticipation' ? clamp(progress * 4) : phase === 'recovery' ? clamp((1 - progress) * 3) : 1;
  if (envelope < 1e-8) return base;
  const result = blend(base, captured, .65 * envelope);
  // Keep the deliberate shoulder load and follow-through legible at bout speed.
  // Imported motion supplies secondary movement, not a replacement strike arc.
  result.torso = blend(base, captured, .2 * envelope).torso;
  // Preserve the authored contact reach. Retargeted clips add timing and body
  // movement, but their bent elbow/hip offsets must not erase the strike itself.
  const contactCommitment = phase === 'active' ? 1 : phase === 'recovery' ? clamp(1 - progress * 2) : clamp((progress - .6) / .4);
  const strikeSide = move.id === 'combo' ? 'left' : 'right';
  const kicking = move.id.includes('kick') || move.id === 'roundhouse';
  const controlled = blend(result, base, .9 + contactCommitment * .1);
  if (kicking) {
    result[`${strikeSide}Leg`] = controlled[`${strikeSide}Leg`];
    result[`${strikeSide}Shin`] = controlled[`${strikeSide}Shin`];
  } else {
    result[`${strikeSide}Arm`] = controlled[`${strikeSide}Arm`];
    result[`${strikeSide}Forearm`] = controlled[`${strikeSide}Forearm`];
    const guardSide = strikeSide === 'left' ? 'right' : 'left';
    result[`${guardSide}Arm`] = base[`${guardSide}Arm`];
    result[`${guardSide}Forearm`] = base[`${guardSide}Forearm`];
  }
  result.rootX = base.rootX; result.rootY = base.rootY; result.rootZ = base.rootZ;
  result.rootTilt = clamp(result.rootTilt, -.22, .22); result.rootRoll = clamp(result.rootRoll, -.18, .18);
  result.rootYaw = base.rootYaw + clamp(captured.rootYaw - base.rootYaw, -.45, .45) * .35 * envelope;
  for (const side of SIDES) {
    // Preserve the support leg; a captured airborne kick must not pull both
    // physical feet off the ground during a standing wrestling strike.
    if (!move.id.includes('kick') && move.id !== 'roundhouse' || side === 'left') {
      const support = blend(base, captured, .18 * envelope);
      result[`${side}Leg`] = support[`${side}Leg`]; result[`${side}Shin`] = support[`${side}Shin`];
    }
  }
  return result;
}

export function authoredIdlePose(base: Pose, elapsed: number): Pose {
  const clip = clips.fighting_idle; if (!clip) return base;
  const phase = (elapsed * .22 % (clip.duration * 2)) / clip.duration;
  const captured = sampleCombatMotion('fighting_idle', (phase <= 1 ? phase : 2 - phase) * clip.duration);
  if (!captured) return base;
  const result = blend(base, captured, .6 * clamp(elapsed * 2));
  result.leftLeg = base.leftLeg; result.rightLeg = base.rightLeg; result.leftShin = base.leftShin; result.rightShin = base.rightShin;
  result.rootTilt = base.rootTilt; result.rootYaw = base.rootYaw; result.rootRoll = base.rootRoll;
  return result;
}
