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
    sinceUpdate.current += dt;
    if (sinceUpdate.current < 1 / 20) return;
    sinceUpdate.current = 0;
    const excitement = model.hype / 100;
    groups.forEach(({ fans }, variant) => {
      const mesh = instances.current.get(variant); if (!mesh) return;
      fans.forEach((fan, index) => {
        const cheer = reducedMotion ? 0 : Math.max(0, Math.sin(age.current * 2.3 + fan.phase)) * excitement * fan.energy;
        dummy.position.set(fan.x, fan.floor + cheer * .045, fan.z);
        dummy.rotation.set(0, fan.yaw, reducedMotion ? 0 : Math.sin(age.current * .7 + fan.phase) * .013);
        dummy.scale.set(fan.width, fan.height, fan.width); dummy.updateMatrix(); mesh.setMatrixAt(index, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    });
  });
  return <>{groups.map(({ mesh, fans }, index) => fans.length > 0 && <instancedMesh key={mesh.name}
    ref={instance => { if (instance) instances.current.set(index, instance); else instances.current.delete(index); }}
    args={[mesh.geometry, mesh.material, fans.length]} frustumCulled={false} />)}</>;
}
