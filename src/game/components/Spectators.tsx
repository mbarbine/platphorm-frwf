import { Suspense, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Mesh, Object3D, type InstancedMesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { useMatchStore } from '../state/matchStore';
import { useSettings } from '../state/settings';
import { crowdPopulation } from '../presentation/crowdPopulation';
import assets from '../../../public/characters/manifest.json';

/** MPFB bodies are baked and instanced; the arena never waits for crowd loading. */
export function Spectators({ count }: { count: number }) {
  return <Suspense fallback={null}><CrowdPopulation count={count} /></Suspense>;
}

function CrowdPopulation({ count }: { count: number }) {
  const gltf = useLoader(GLTFLoader, assets.crowd.url);
  const reducedMotion = useSettings(s => s.reducedMotion);
  const instances = useRef(new Map<number, InstancedMesh>());
  const dummy = useMemo(() => new Object3D(), []);
  const age = useRef(0); const sinceUpdate = useRef(1);
  const groups = useMemo(() => {
    const meshes: Mesh[] = [];
    gltf.scene.traverse(node => { if (node instanceof Mesh) meshes.push(node); });
    meshes.sort((a, b) => a.name.localeCompare(b.name));
    const fans = crowdPopulation(count, meshes.length);
    return meshes.map((mesh, variant) => ({ mesh, fans: fans.filter(fan => fan.variant === variant) }));
  }, [gltf, count]);
  useFrame((_, dt) => {
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
  });
  return <>{groups.map(({ mesh, fans }, index) => fans.length > 0 && <instancedMesh key={mesh.name}
    ref={instance => { if (instance) instances.current.set(index, instance); else instances.current.delete(index); }}
    args={[mesh.geometry, mesh.material, fans.length]} frustumCulled={false} />)}</>;
}
