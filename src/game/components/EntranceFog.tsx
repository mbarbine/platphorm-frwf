import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, Object3D, type InstancedMesh, type MeshBasicMaterial } from 'three';
import { useSettings } from '../state/settings';
import { useMatchStore } from '../state/matchStore';
import { fogBurstEnvelope } from '../presentation/crowdActivity';

/** Pooled soft particles stay at the entrance, below the view into the ring. */
// OPTIMIZATION: Pre-calculate static fog particle offset factors to avoid repeated modulo operations per frame inside useFrame.
const FOG_PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  i,
  timeOffset: i * .31,
  baseX: i % 2 ? -3.2 : 3.2,
  dirX: i % 3 - 1,
  baseZ: 10.3 + (i % 4) * .22,
}));

export function EntranceFog() {
  const reduced = useSettings(s => s.reducedMotion);
  const mesh = useRef<InstancedMesh>(null); const material = useRef<MeshBasicMaterial>(null);
  const age = useRef(0); const dummy = useMemo(() => new Object3D(),[]);
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width=64;canvas.height=64;
    const ctx=canvas.getContext('2d');
    if(ctx) {const gradient=ctx.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'#d7ddebc0');gradient.addColorStop(.45,'#d7ddeb60');gradient.addColorStop(1,'#d7ddeb00');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);}
    return new CanvasTexture(canvas);
  },[]);
  useEffect(() => () => texture.dispose(),[texture]);
  useFrame(({camera},dt) => {
    if(!mesh.current || !material.current) return;
    if(!useMatchStore.getState().model.paused && !reduced) age.current += Math.min(dt,.1);
    const envelope = reduced ? 0 : fogBurstEnvelope(age.current);
    mesh.current.visible = envelope > .001; material.current.opacity = envelope*.2;
    if(envelope <= .001) return;
    for(let i=0;i<FOG_PARTICLES.length;i++) {
      const p = FOG_PARTICLES[i];
      if (!p) continue;
      const life=((age.current+p.timeOffset)%3)/3;
      dummy.position.set(p.baseX+p.dirX*life*.8,.55+life*1.2,p.baseZ+life*2);
      dummy.quaternion.copy(camera.quaternion);dummy.scale.setScalar(.35+life*1.7);dummy.updateMatrix();mesh.current.setMatrixAt(i,dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate=true;
  });
  return <instancedMesh ref={mesh} args={[undefined,undefined,24]} frustumCulled={false} name="entrance-fog">
    <planeGeometry args={[1,1]}/><meshBasicMaterial ref={material} map={texture} transparent opacity={0} depthWrite={false}/>
  </instancedMesh>;
}
