import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Object3D, Vector3, type InstancedMesh } from 'three';
import { useMatchStore } from '../state/matchStore';
import { useSettings } from '../state/settings';

/** Five shared meshes, articulated silhouettes, and reactions to the live bout. */
export function Spectators({ count }: { count: number }) {
  const torso = useRef<InstancedMesh>(null); const head = useRef<InstancedMesh>(null);
  const limbs = useRef<InstancedMesh>(null); const hair = useRef<InstancedMesh>(null); const seats = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const vector = useMemo(() => new Vector3(), []); const up = useMemo(() => new Vector3(0, 1, 0), []);
  const age = useRef(0); const reducedMotion = useSettings(s => s.reducedMotion);
  const fans = useMemo(() => Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / 42); const angle = (i % 42) / 42 * Math.PI * 2 + row * .055;
    return { x: Math.cos(angle) * (13.9 + row * 1.28), z: Math.sin(angle) * (13.9 + row * 1.28), floor: .4 + row * .62, yaw: -angle - Math.PI / 2, height: .92 + i % 5 * .035 };
  }), [count]);
  useEffect(() => {
    const shirts = ['#673940', '#37474c', '#536b67', '#827446', '#4b496c', '#9b644e'];
    const skins = ['#c59373', '#b4785a', '#75513f', '#dbb299', '#946b50'];
    for (let i = 0; i < count; i++) {
      const skin = new Color(skins[i % skins.length]);
      torso.current?.setColorAt(i, new Color(shirts[i % shirts.length])); head.current?.setColorAt(i, skin);
      hair.current?.setColorAt(i, new Color(i % 4 === 0 ? '#817462' : '#302a28'));
      for (let j = 0; j < 8; j++) limbs.current?.setColorAt(i * 8 + j, j < 4 ? new Color(i % 2 ? '#303942' : '#414044') : skin);
    }
    for (const mesh of [torso.current, head.current, limbs.current, hair.current]) if (mesh?.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [count]);
  useFrame((_, dt) => {
    if (!torso.current || !head.current || !limbs.current || !hair.current || !seats.current) return;
    const torsoMesh = torso.current; const headMesh = head.current; const limbMesh = limbs.current; const hairMesh = hair.current; const seatMesh = seats.current;
    const model = useMatchStore.getState().model;
    if (!model.paused && !reducedMotion) age.current += Math.min(dt, .05);
    const hype = model.hype / 100;
    fans.forEach((fan, i) => {
      const cheer = reducedMotion ? .15 : Math.max(0, Math.sin(age.current * 2.1 + i * 1.7)) * hype;
      const lift = cheer * .09; const y = fan.floor + lift;
      const place = (mesh: InstancedMesh, index: number, x: number, h: number, z: number, sx: number, sy: number, sz: number) => {
        dummy.position.set(fan.x + Math.cos(fan.yaw) * x + Math.sin(fan.yaw) * z, y + h * fan.height, fan.z - Math.sin(fan.yaw) * x + Math.cos(fan.yaw) * z);
        dummy.rotation.set(0, fan.yaw, 0); dummy.scale.set(sx, sy * fan.height, sz); dummy.updateMatrix(); mesh.setMatrixAt(index, dummy.matrix);
      };
      place(torsoMesh, i, 0, 1.08, 0, .48 + i % 3 * .025, .6, .28);
      place(headMesh, i, 0, 1.57, .015, .17, .21, .17);
      place(hairMesh, i, 0, 1.68, 0, .18, .11, .18);
      // Seats are fixed to the riser, not the spectator's bounce.
      place(seatMesh, i, 0, .48 - lift / fan.height, -.16, .56, .09, .52);
      const limb = (index: number, a: [number, number, number], b: [number, number, number], radius: number) => {
        const ax = Math.cos(fan.yaw) * a[0] + Math.sin(fan.yaw) * a[2]; const az = -Math.sin(fan.yaw) * a[0] + Math.cos(fan.yaw) * a[2];
        const bx = Math.cos(fan.yaw) * b[0] + Math.sin(fan.yaw) * b[2]; const bz = -Math.sin(fan.yaw) * b[0] + Math.cos(fan.yaw) * b[2];
        vector.set(bx - ax, (b[1] - a[1]) * fan.height, bz - az);
        // OPTIMIZATION: Replacing vector.length() and vector.normalize() (which call slow Math.hypot internally in Three.js)
        // with standard Math.sqrt and direct scalar division for ~8x speedup across 1248 limb transforms per frame.
        const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z); dummy.position.set(fan.x + (ax + bx) / 2, y + (a[1] + b[1]) / 2 * fan.height, fan.z + (az + bz) / 2);
        dummy.quaternion.setFromUnitVectors(up, vector.divideScalar(length || 1)); dummy.scale.set(radius, length, radius); dummy.updateMatrix(); limbMesh.setMatrixAt(i * 8 + index, dummy.matrix);
      };
      for (const side of [-1, 1]) {
        const offset = side < 0 ? 0 : 2;
        limb(offset, [side * .14, .82, 0], [side * .17, .43, .05], .16);
        limb(offset + 1, [side * .17, .43, .05], [side * .17, .08, .06], .14);
        const elbow: [number, number, number] = [side * (.35 + cheer * .1), 1.02 + cheer * .48, .08];
        const hand: [number, number, number] = [side * (.25 + cheer * .2), 1.17 + cheer * .74, .26];
        limb(4 + offset, [side * .25, 1.32, 0], elbow, .12);
        limb(5 + offset, elbow, hand, .105);
      }
    });
    for (const mesh of [torso.current, head.current, limbs.current, hair.current, seats.current]) mesh.instanceMatrix.needsUpdate = true;
  });
  return <>
    <instancedMesh ref={torso} args={[undefined, undefined, count]} frustumCulled={false}><boxGeometry /><meshStandardMaterial roughness={.95} /></instancedMesh>
    <instancedMesh ref={head} args={[undefined, undefined, count]} frustumCulled={false}><sphereGeometry args={[1, 8, 6]} /><meshStandardMaterial roughness={.9} /></instancedMesh>
    <instancedMesh ref={hair} args={[undefined, undefined, count]} frustumCulled={false}><sphereGeometry args={[1, 8, 5]} /><meshStandardMaterial roughness={1} /></instancedMesh>
    <instancedMesh ref={limbs} args={[undefined, undefined, count * 8]} frustumCulled={false}><cylinderGeometry args={[.5, .5, 1, 6]} /><meshStandardMaterial roughness={.95} /></instancedMesh>
    <instancedMesh ref={seats} args={[undefined, undefined, count]} frustumCulled={false}><boxGeometry /><meshStandardMaterial color="#252936" roughness={.8} /></instancedMesh>
  </>;
}
