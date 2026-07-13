import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group, Mesh, MeshBasicMaterial } from 'three';
import { fighterById } from '../data/fighters';
import { getMove } from '../data/moves';
import { getPairedPose, getStrikePose, getStrikeReactionPose } from '../animation/choreography';
import { POSES } from '../animation/poses';
import type { AnimationKey, FighterId, FighterRuntime } from '../types/game';

interface Props { runtime?: FighterRuntime; counterpart?: FighterRuntime; fighterId?: FighterId; preview?: boolean; side?: 'player' | 'opponent' }

const limbMaterial = (color: string, emissive: string) => <meshStandardMaterial color={color} roughness={.48} metalness={.22} emissive={emissive} emissiveIntensity={.12} />;

export function FighterModel({ runtime, counterpart, fighterId, preview = false, side = 'player' }: Props) {
  const id = runtime?.definitionId ?? fighterId ?? 'atlas';
  const fighter = fighterById(id);
  const root = useRef<Group>(null); const torso = useRef<Group>(null); const leftArm = useRef<Group>(null); const rightArm = useRef<Group>(null);
  const leftForearm = useRef<Group>(null); const rightForearm = useRef<Group>(null); const leftLeg = useRef<Group>(null); const rightLeg = useRef<Group>(null);
  const leftShin = useRef<Group>(null); const rightShin = useRef<Group>(null); const flash = useRef<Mesh>(null); const previousHealth = useRef(runtime?.health ?? 100);
  const phaseOffset = side === 'player' ? 0 : Math.PI;
  const width = fighter.proportions.width; const height = fighter.proportions.height;
  const geometry = useMemo(() => ({ torso: [.72 * width, .78 * height, .38 * width] as const }), [height, width]);

  useFrame(({ clock }, delta) => {
    if (!root.current || !torso.current || !leftArm.current || !rightArm.current || !leftForearm.current || !rightForearm.current || !leftLeg.current || !rightLeg.current || !leftShin.current || !rightShin.current) return;
    const t = clock.elapsedTime;
    let key: AnimationKey = 'combatIdle';
    if (preview) key = 'taunt';
    else if (runtime) {
      if (runtime.moveId) {
        const move = getMove(runtime.moveId);
        key = move.category === 'grapple' && runtime.attackPhase === 'anticipation' && runtime.phaseElapsed < move.anticipationDuration * .45 ? 'grappleEntry' : move.animationKey;
      }
      else if (runtime.state === 'locomotion') key = Math.hypot(runtime.velocity.x, runtime.velocity.z) > 3.8 ? 'run' : 'walk';
      else if (runtime.state === 'blocking') key = 'block';
      else if (runtime.state === 'climbing') key = 'climb';
      else if (runtime.state === 'grabbed') key = 'stagger';
      else if (runtime.state === 'airborne') key = 'knockdown';
      else if (runtime.state === 'downed') key = 'downed';
      else if (runtime.state === 'recovering') key = 'recovery';
      else if (runtime.state === 'staggered') key = 'stagger';
      else if (runtime.state === 'pinning') key = 'pin';
      else if (runtime.state === 'pinned') key = 'kickout';
      else if (runtime.state === 'victorious') key = 'victory';
      else if (runtime.state === 'defeated') key = 'defeat';
    }
    let animatedPose = POSES[key];
    if (runtime?.moveId) {
      const move = getMove(runtime.moveId);
      animatedPose = getPairedPose(move, 'actor', runtime.attackPhase, runtime.phaseElapsed, runtime.definitionId) ?? getStrikePose(move, runtime.attackPhase, runtime.phaseElapsed) ?? animatedPose;
    }
    if (runtime && counterpart?.moveId && ['grabbed', 'airborne', 'downed', 'staggered'].includes(runtime.state)) {
      const holdingMove = getMove(counterpart.moveId);
      animatedPose = getPairedPose(holdingMove, 'victim', counterpart.attackPhase, counterpart.phaseElapsed, counterpart.definitionId)
        ?? getStrikeReactionPose(holdingMove, counterpart.attackPhase, counterpart.phaseElapsed) ?? animatedPose;
    }
    const smooth = 1 - Math.exp(-delta * (runtime?.attackPhase === 'active' ? 19 : 13));
    const bob = ['combatIdle', 'idle', 'taunt'].includes(key) ? Math.sin(t * 2.4 + phaseOffset) * .035 : Math.abs(Math.sin(t * 7)) * .035;
    root.current.position.x += (animatedPose.rootX - root.current.position.x) * smooth;
    root.current.position.y += ((animatedPose.rootY + bob) - root.current.position.y) * smooth;
    root.current.position.z += (animatedPose.rootZ - root.current.position.z) * smooth;
    root.current.rotation.x += (animatedPose.rootTilt - root.current.rotation.x) * smooth;
    root.current.rotation.y += (animatedPose.rootYaw - root.current.rotation.y) * smooth;
    root.current.rotation.z += (animatedPose.rootRoll - root.current.rotation.z) * smooth;
    const apply = (group: Group, rotation: [number, number, number]): void => {
      group.rotation.x += (rotation[0] - group.rotation.x) * smooth; group.rotation.y += (rotation[1] - group.rotation.y) * smooth; group.rotation.z += (rotation[2] - group.rotation.z) * smooth;
    };
    apply(torso.current, animatedPose.torso); apply(leftArm.current, animatedPose.leftArm); apply(rightArm.current, animatedPose.rightArm);
    apply(leftForearm.current, animatedPose.leftForearm); apply(rightForearm.current, animatedPose.rightForearm);
    apply(leftLeg.current, animatedPose.leftLeg); apply(rightLeg.current, animatedPose.rightLeg); apply(leftShin.current, animatedPose.leftShin); apply(rightShin.current, animatedPose.rightShin);
    if (runtime) {
      root.current.parent?.position.set(runtime.position.x, 2.05, runtime.position.z);
      if (root.current.parent) root.current.parent.rotation.y = runtime.facing;
    } else root.current.rotation.y = Math.sin(t * .45) * .16;
    if (runtime && runtime.health < previousHealth.current && flash.current) {
      flash.current.visible = true; (flash.current.material as MeshBasicMaterial).opacity = .42;
    }
    if (runtime) previousHealth.current = runtime.health;
    if (flash.current) {
      const material = flash.current.material as MeshBasicMaterial; material.opacity = Math.max(0, material.opacity - delta * 4.8);
      if (material.opacity <= .01) flash.current.visible = false;
    }
  });

  const Headwear = () => {
    if (fighter.proportions.headwear === 'mohawk') return <mesh position={[0, 2.58 * height, 0]}><boxGeometry args={[.16, .38, .55]} />{limbMaterial(fighter.palette.emissive, fighter.palette.emissive)}</mesh>;
    if (fighter.proportions.headwear === 'crown') return <group position={[0, 2.55 * height, 0]}>{[-.23, 0, .23].map((x) => <mesh key={x} position={[x, .12, 0]} rotation={[0, 0, x]}><coneGeometry args={[.14, .38, 4]} />{limbMaterial(fighter.palette.emissive, fighter.palette.emissive)}</mesh>)}</group>;
    if (fighter.proportions.headwear === 'mask') return <mesh position={[0, 2.38 * height, .23]}><boxGeometry args={[.48, .28, .08]} />{limbMaterial(fighter.palette.emissive, fighter.palette.emissive)}</mesh>;
    if (fighter.proportions.headwear === 'mullet') return <group>
      <mesh position={[0, 2.56 * height, .02]}><sphereGeometry args={[.39, 10, 7, 0, Math.PI * 2, 0, Math.PI * .56]} />{limbMaterial('#382720', '#6d4128')}</mesh>
      <mesh position={[0, 2.31 * height, -.28]}><boxGeometry args={[.55, .68, .18]} />{limbMaterial('#382720', '#6d4128')}</mesh>
      <mesh position={[0, 2.14 * height, .29]}><dodecahedronGeometry args={[.3, 0]} />{limbMaterial('#39251e', '#6d4128')}</mesh>
    </group>;
    return <mesh position={[0, 2.48 * height, 0]} rotation={[0, 0, -.08]}><torusGeometry args={[.34, .08, 6, 16]} />{limbMaterial(fighter.palette.primary, fighter.palette.emissive)}</mesh>;
  };

  const Arm = ({ side: armSide }: { side: -1 | 1 }) => <group ref={armSide < 0 ? leftArm : rightArm} position={[armSide * .74 * width, 1.85 * height, 0]}>
    <mesh position={[0, -.02, 0]}><sphereGeometry args={[.28 * width, 8, 6]} />{limbMaterial(fighter.palette.secondary, fighter.palette.emissive)}</mesh>
    <mesh position={[0, -.34, 0]}><capsuleGeometry args={[.2 * width, .54, 5, 8]} />{limbMaterial(fighter.palette.skin, fighter.palette.emissive)}</mesh>
    <mesh position={[0, -.62, -.01]}><torusGeometry args={[.2 * width, .075, 5, 10]} />{limbMaterial('#171523', fighter.palette.emissive)}</mesh>
    <group ref={armSide < 0 ? leftForearm : rightForearm} position={[0, -.66, 0]}>
      <mesh position={[0, -.25, 0]}><capsuleGeometry args={[.17 * width, .38, 5, 8]} />{limbMaterial(fighter.palette.primary, fighter.palette.emissive)}</mesh>
      <mesh position={[0, -.57, .04]}><boxGeometry args={[.31 * width, .28, .32]} />{limbMaterial(fighter.palette.secondary, fighter.palette.emissive)}</mesh>
      <mesh position={[0, -.61, .2]}><boxGeometry args={[.18 * width, .13, .22]} />{limbMaterial(fighter.palette.skin, fighter.palette.emissive)}</mesh>
    </group>
  </group>;
  const Leg = ({ side: legSide }: { side: -1 | 1 }) => <group ref={legSide < 0 ? leftLeg : rightLeg} position={[legSide * .3 * width, .83 * height, 0]}>
    <mesh position={[0, -.38, 0]}><capsuleGeometry args={[.23 * width, .56, 5, 8]} />{limbMaterial(fighter.palette.skin, fighter.palette.emissive)}</mesh>
    <mesh position={[0, -.69, -.16]}><boxGeometry args={[.43 * width, .28, .18]} />{limbMaterial('#171523', fighter.palette.emissive)}</mesh>
    <group ref={legSide < 0 ? leftShin : rightShin} position={[0, -.7, 0]}>
      <mesh position={[0, -.3, 0]}><capsuleGeometry args={[.2 * width, .48, 5, 8]} />{limbMaterial(fighter.palette.secondary, fighter.palette.emissive)}</mesh>
      <mesh position={[0, -.67, .12]}><boxGeometry args={[.4 * width, .36, .62]} />{limbMaterial('#11131d', fighter.palette.emissive)}</mesh>
      <mesh position={[0, -.87, .18]}><boxGeometry args={[.44 * width, .08, .7]} />{limbMaterial(fighter.palette.emissive, fighter.palette.emissive)}</mesh>
    </group>
  </group>;

  return <group><group ref={root} scale={preview ? 1.05 : 1}>
    <group ref={torso}>
      <mesh position={[0, 2.02 * height, 0]}><cylinderGeometry args={[.18 * width, .23 * width, .28, 8]} />{limbMaterial(fighter.palette.skin, fighter.palette.emissive)}</mesh>
      <mesh position={[0, 1.62 * height, 0]}><boxGeometry args={geometry.torso} />{limbMaterial(fighter.palette.primary, fighter.palette.emissive)}</mesh>
      <mesh position={[0, 1.72 * height, .4 * width]}><octahedronGeometry args={[.24 * width, 0]} />{limbMaterial(fighter.palette.secondary, fighter.palette.emissive)}</mesh>
      <mesh position={[0, 1.42 * height, .41 * width]}><boxGeometry args={[.62 * width, .16, .06]} />{limbMaterial(fighter.palette.emissive, fighter.palette.emissive)}</mesh>
      {id === 'chad' && <group position={[0, 1.66 * height, .405 * width]}>
        {[-.2, 0, .2].map((x) => <mesh key={x} position={[x, 0, 0]}><boxGeometry args={[.055, .7, .035]} />{limbMaterial('#d8c0a0', '#5e301f')}</mesh>)}
        <mesh position={[0, -.02, -.01]}><boxGeometry args={[.7 * width, .055, .035]} />{limbMaterial('#d8c0a0', '#5e301f')}</mesh>
      </group>}
      <mesh position={[0, 2.31 * height, 0]}><dodecahedronGeometry args={[.38, 0]} />{limbMaterial(fighter.palette.skin, fighter.palette.emissive)}</mesh>
      <group position={[0, 2.36 * height, .34]}>
        <mesh position={[-.13, .04, 0]}><sphereGeometry args={[.052, 7, 5]} /><meshStandardMaterial color="#f7fbff" emissive={fighter.palette.emissive} emissiveIntensity={.35} /></mesh>
        <mesh position={[.13, .04, 0]}><sphereGeometry args={[.052, 7, 5]} /><meshStandardMaterial color="#f7fbff" emissive={fighter.palette.emissive} emissiveIntensity={.35} /></mesh>
        <mesh position={[-.13, .04, .045]}><sphereGeometry args={[.022, 6, 4]} /><meshBasicMaterial color="#09070d" /></mesh>
        <mesh position={[.13, .04, .045]}><sphereGeometry args={[.022, 6, 4]} /><meshBasicMaterial color="#09070d" /></mesh>
        <mesh position={[0, -.035, .015]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[.045, .13, 5]} />{limbMaterial(fighter.palette.skin, fighter.palette.emissive)}</mesh>
        <mesh position={[0, -.15, .025]}><boxGeometry args={[.17, .025, .035]} /><meshBasicMaterial color={id === 'chad' ? '#302019' : '#52162e'} /></mesh>
      </group>
      <mesh position={[0, 1.02 * height, 0]}><boxGeometry args={[.65 * width, .3, .42 * width]} />{limbMaterial(fighter.palette.secondary, fighter.palette.emissive)}</mesh>
      <Headwear />
    </group>
    <Arm side={-1} /><Arm side={1} /><Leg side={-1} /><Leg side={1} />
    <mesh ref={flash} position={[0, 1.25, 0]} scale={[1.25 * width, 1.55 * height, .8]} visible={false}><boxGeometry /><meshBasicMaterial transparent depthWrite={false} opacity={0} color="white" /></mesh>
  </group></group>;
}
