import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group, Mesh, MeshBasicMaterial } from 'three';
import { fighterById } from '../data/fighters';
import { getMove } from '../data/moves';
import { POSES } from '../animation/poses';
import type { AnimationKey, FighterId, FighterRuntime } from '../types/game';

interface Props { runtime?: FighterRuntime; fighterId?: FighterId; preview?: boolean; side?: 'player' | 'opponent' }

const limbMaterial = (color: string, emissive: string) => <meshStandardMaterial color={color} roughness={.48} metalness={.22} emissive={emissive} emissiveIntensity={.12} />;

export function FighterModel({ runtime, fighterId, preview = false, side = 'player' }: Props) {
  const id = runtime?.definitionId ?? fighterId ?? 'atlas';
  const fighter = fighterById(id);
  const root = useRef<Group>(null); const torso = useRef<Group>(null); const leftArm = useRef<Group>(null); const rightArm = useRef<Group>(null);
  const leftLeg = useRef<Group>(null); const rightLeg = useRef<Group>(null); const flash = useRef<Mesh>(null);
  const phaseOffset = side === 'player' ? 0 : Math.PI;
  const width = fighter.proportions.width; const height = fighter.proportions.height;
  const geometry = useMemo(() => ({ shoulder: [.28 * width, .42, .28] as const, torso: [.72 * width, .78 * height, .38 * width] as const }), [height, width]);

  useFrame(({ clock }, delta) => {
    if (!root.current || !torso.current || !leftArm.current || !rightArm.current || !leftLeg.current || !rightLeg.current) return;
    const t = clock.elapsedTime;
    let key: AnimationKey = 'combatIdle';
    if (preview) key = 'taunt';
    else if (runtime) {
      if (runtime.moveId) key = getMove(runtime.moveId).animationKey;
      else if (runtime.state === 'locomotion') key = Math.hypot(runtime.velocity.x, runtime.velocity.z) > 3.8 ? 'run' : 'walk';
      else if (runtime.state === 'downed') key = 'downed';
      else if (runtime.state === 'recovering') key = 'recovery';
      else if (runtime.state === 'staggered') key = 'stagger';
      else if (runtime.state === 'pinning') key = 'pin';
      else if (runtime.state === 'pinned') key = 'kickout';
      else if (runtime.state === 'victorious') key = 'victory';
      else if (runtime.state === 'defeated') key = 'defeat';
    }
    const pose = POSES[key]; const smooth = 1 - Math.exp(-delta * 12);
    const bob = ['combatIdle', 'idle', 'taunt'].includes(key) ? Math.sin(t * 2.4 + phaseOffset) * .035 : Math.abs(Math.sin(t * 7)) * .035;
    root.current.position.y += ((pose.rootY + bob) - root.current.position.y) * smooth;
    root.current.rotation.x += (pose.rootTilt - root.current.rotation.x) * smooth;
    const apply = (group: Group, rotation: [number, number, number]): void => {
      group.rotation.x += (rotation[0] - group.rotation.x) * smooth; group.rotation.y += (rotation[1] - group.rotation.y) * smooth; group.rotation.z += (rotation[2] - group.rotation.z) * smooth;
    };
    apply(torso.current, pose.torso); apply(leftArm.current, pose.leftArm); apply(rightArm.current, pose.rightArm); apply(leftLeg.current, pose.leftLeg); apply(rightLeg.current, pose.rightLeg);
    if (runtime) {
      root.current.parent?.position.set(runtime.position.x, 2.05, runtime.position.z);
      if (root.current.parent) root.current.parent.rotation.y = runtime.facing;
    } else root.current.rotation.y += delta * .25;
    if (flash.current) { const material = flash.current.material as MeshBasicMaterial; material.opacity = Math.max(0, material.opacity - delta * 3.5); }
  });

  const Headwear = () => {
    if (fighter.proportions.headwear === 'mohawk') return <mesh position={[0, 2.58 * height, 0]}><boxGeometry args={[.16, .38, .55]} />{limbMaterial(fighter.palette.emissive, fighter.palette.emissive)}</mesh>;
    if (fighter.proportions.headwear === 'crown') return <group position={[0, 2.55 * height, 0]}>{[-.23, 0, .23].map((x) => <mesh key={x} position={[x, .12, 0]} rotation={[0, 0, x]}><coneGeometry args={[.14, .38, 4]} />{limbMaterial(fighter.palette.emissive, fighter.palette.emissive)}</mesh>)}</group>;
    if (fighter.proportions.headwear === 'mask') return <mesh position={[0, 2.38 * height, -.23]}><boxGeometry args={[.48, .28, .08]} />{limbMaterial(fighter.palette.emissive, fighter.palette.emissive)}</mesh>;
    return <mesh position={[0, 2.48 * height, 0]} rotation={[0, 0, -.08]}><torusGeometry args={[.34, .08, 6, 16]} />{limbMaterial(fighter.palette.primary, fighter.palette.emissive)}</mesh>;
  };

  const Arm = ({ side: armSide }: { side: -1 | 1 }) => <group ref={armSide < 0 ? leftArm : rightArm} position={[armSide * .74 * width, 1.85 * height, 0]}>
    <mesh position={[0, -.34, 0]}><capsuleGeometry args={[.2 * width, .54, 5, 8]} />{limbMaterial(fighter.palette.skin, fighter.palette.emissive)}</mesh>
    <mesh position={[0, -.79, -.02]}><capsuleGeometry args={[.17 * width, .38, 5, 8]} />{limbMaterial(fighter.palette.primary, fighter.palette.emissive)}</mesh>
    <mesh position={[0, -1.08, -.04]}><boxGeometry args={[.31 * width, .28, .32]} />{limbMaterial(fighter.palette.secondary, fighter.palette.emissive)}</mesh>
  </group>;
  const Leg = ({ side: legSide }: { side: -1 | 1 }) => <group ref={legSide < 0 ? leftLeg : rightLeg} position={[legSide * .3 * width, .83 * height, 0]}>
    <mesh position={[0, -.38, 0]}><capsuleGeometry args={[.23 * width, .56, 5, 8]} />{limbMaterial(fighter.palette.skin, fighter.palette.emissive)}</mesh>
    <mesh position={[0, -.92, 0]}><capsuleGeometry args={[.2 * width, .48, 5, 8]} />{limbMaterial(fighter.palette.secondary, fighter.palette.emissive)}</mesh>
    <mesh position={[0, -1.28, -.1]}><boxGeometry args={[.4 * width, .36, .62]} />{limbMaterial('#11131d', fighter.palette.emissive)}</mesh>
  </group>;

  return <group><group ref={root} scale={preview ? 1.15 : 1}>
    <group ref={torso}>
      <mesh position={[0, 1.62 * height, 0]}><boxGeometry args={geometry.torso} />{limbMaterial(fighter.palette.primary, fighter.palette.emissive)}</mesh>
      <mesh position={[0, 1.42 * height, -.41 * width]}><boxGeometry args={[.62 * width, .16, .06]} />{limbMaterial(fighter.palette.emissive, fighter.palette.emissive)}</mesh>
      <mesh position={[0, 2.31 * height, 0]}><dodecahedronGeometry args={[.38, 0]} />{limbMaterial(fighter.palette.skin, fighter.palette.emissive)}</mesh>
      <mesh position={[0, 1.02 * height, 0]}><boxGeometry args={[.65 * width, .3, .42 * width]} />{limbMaterial(fighter.palette.secondary, fighter.palette.emissive)}</mesh>
      <Headwear />
    </group>
    <Arm side={-1} /><Arm side={1} /><Leg side={-1} /><Leg side={1} />
    <mesh ref={flash} scale={[1.25 * width, 2.7 * height, .8]} visible={false}><boxGeometry /><meshBasicMaterial transparent opacity={0} color="white" /></mesh>
  </group></group>;
}
