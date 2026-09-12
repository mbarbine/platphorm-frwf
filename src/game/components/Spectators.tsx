import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { CanvasTexture, DoubleSide, InstancedBufferAttribute, Mesh, MeshStandardMaterial, Object3D, SRGBColorSpace, Vector3, type InstancedMesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { useMatchStore } from '../state/matchStore';
import { useSettings } from '../state/settings';
import { crowdPopulation } from '../presentation/crowdPopulation';
import { CROWD_SIGNS, fanArmAngles } from '../presentation/crowdActivity';
import assets from '../../../public/characters/manifest.json';

export function Spectators({ count }: { count: number }) {
  return <Suspense fallback={null}><CrowdPopulation count={count} /></Suspense>;
}

function signTexture(message: string, index: number) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 288;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = ['#d8bd88','#eff09b','#e6ded0','#e6adb8'][index % 4]!; ctx.fillRect(0,0,512,288);
    // Uneven marker edges and cardboard grain remain readable from the ring.
    ctx.strokeStyle = '#786546'; ctx.lineWidth = 7; ctx.strokeRect(8,7,495,273);
    for (let y=17;y<280;y+=9) { ctx.fillStyle = '#6e50310b'; ctx.fillRect(0,y,512,1); }
    ctx.fillStyle = '#242019'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const words = message.split(' '); const lines = message.length > 15 ? [words.slice(0,Math.ceil(words.length/2)).join(' '),words.slice(Math.ceil(words.length/2)).join(' ')] : [message];
    ctx.font = `900 ${message.length < 6 ? 100 : 49}px sans-serif`;
    lines.forEach((line,i) => ctx.fillText(line,256,144+(i-(lines.length-1)/2)*65,460));
  }
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; return texture;
}

function CrowdPopulation({ count }: { count: number }) {
  const gltf = useLoader(GLTFLoader, assets.crowd.url);
  const reducedMotion = useSettings(s => s.reducedMotion);
  const instances = useRef(new Map<number, InstancedMesh>());
  const props = useRef(new Map<number, InstancedMesh>());
  const dummy = useMemo(() => new Object3D(), []);
  const propDummy = useMemo(() => new Object3D(), []);
  const age = useRef(0); const sinceUpdate = useRef(1);
  const textures = useMemo(() => CROWD_SIGNS.map(signTexture), []);
  const groups = useMemo(() => {
    const meshes: Mesh[] = [];
    gltf.scene.traverse(node => { if (node instanceof Mesh) meshes.push(node); });
    meshes.sort((a,b) => a.name.localeCompare(b.name));
    const fans = crowdPopulation(count, meshes.length);
<<<<<<< HEAD
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
=======
    return meshes.map((mesh, variant) => {
      const members = fans.filter(fan => fan.variant === variant);
      const anatomy = assets.crowd.variants.find(item => item.name === mesh.name);
      if (!anatomy) throw new Error(`Missing crowd anatomy: ${mesh.name}`);
      const geometry = mesh.geometry.clone();
      const angles = new InstancedBufferAttribute(new Float32Array(members.length * 2),2);
      geometry.setAttribute('fanAngles',angles);
      const material = (mesh.material as MeshStandardMaterial).clone();
      material.onBeforeCompile = shader => {
        shader.uniforms.fanLeftShoulder = {value:new Vector3(...anatomy.leftShoulder as [number,number,number])};
        shader.uniforms.fanRightShoulder = {value:new Vector3(...anatomy.rightShoulder as [number,number,number])};
        shader.vertexShader = `attribute vec2 fanAngles;
          uniform vec3 fanLeftShoulder; uniform vec3 fanRightShoulder;
          mat3 fanTurn(float angle) { float c=cos(angle),s=sin(angle); return mat3(c,s,0.,-s,c,0.,0.,0.,1.); }
          ${shader.vertexShader}`;
        // UV0 stores baked arm influence, including fingers. No full skeleton per spectator.
        shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
          objectNormal = mix(objectNormal, fanTurn(fanAngles.x)*objectNormal, uv.x);
          objectNormal = mix(objectNormal, fanTurn(fanAngles.y)*objectNormal, uv.y);`);
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          transformed = mix(transformed, fanLeftShoulder + fanTurn(fanAngles.x)*(transformed-fanLeftShoulder), uv.x);
          transformed = mix(transformed, fanRightShoulder + fanTurn(fanAngles.y)*(transformed-fanRightShoulder), uv.y);`);
      };
      material.customProgramCacheKey = () => 'frwf-crowd-arms-v1';
      return {geometry,material,angles,fans:members,anatomy};
>>>>>>> 8ba2c0b (update)
    });
  },[gltf,count]);
  const propCounts = useMemo(() => {
    const counts = Array<number>(9).fill(0);
    groups.forEach(group => group.fans.forEach(fan => { if(fan.prop < .22) counts[fan.prop < .15 ? fan.message : 8]!++; }));
    return counts;
  },[groups]);
  useEffect(() => () => { groups.forEach(g => {g.geometry.dispose();g.material.dispose();}); },[groups]);
  useEffect(() => () => textures.forEach(t => t.dispose()),[textures]);
  useFrame((_,dt) => {
    const model = useMatchStore.getState().model;
    if(!model.paused && !reducedMotion) age.current += Math.min(dt,.1);
    sinceUpdate.current += dt; if(sinceUpdate.current < 1/20) return; sinceUpdate.current = 0;
    const cursors = Array<number>(9).fill(0);
    groups.forEach(({fans,angles,anatomy},variant) => {
      const mesh = instances.current.get(variant); if(!mesh) return;
      fans.forEach((fan,index) => {
        const arms = fanArmAngles(age.current,fan.phase,fan.activity,fan.prop,model.hype/100,reducedMotion);
        angles.setXY(index,arms.left,arms.right);
        dummy.position.set(fan.x,fan.floor,fan.z);
        dummy.rotation.set(0,fan.yaw,reducedMotion ? 0 : Math.sin(age.current*.7+fan.phase)*.012);
        dummy.scale.set(fan.width,fan.height,fan.width); dummy.updateMatrix(); mesh.setMatrixAt(index,dummy.matrix);
        if(fan.prop < .22) {
          const sign = fan.prop < .15; const slot = sign ? fan.message : 8; const propMesh = props.current.get(slot);
          const armLength = anatomy.headY*.35;
          propDummy.position.set(sign ? 0 : anatomy.rightShoulder[0]! + Math.sin(arms.right)*armLength,
            anatomy.rightShoulder[1]! - Math.cos(sign ? 2.75 : arms.right)*armLength + (sign ? .17 : .025), .045);
          propDummy.rotation.set(0,0,0); propDummy.scale.set(sign ? .85 : .026,sign ? .48 : .06,sign ? .026 : .026);
          propDummy.updateMatrix(); propDummy.matrix.premultiply(dummy.matrix);
          propMesh?.setMatrixAt(cursors[slot]!,propDummy.matrix); cursors[slot]!++;
        }
      });
      mesh.instanceMatrix.needsUpdate = true; angles.needsUpdate = true;
    });
    props.current.forEach(mesh => {mesh.instanceMatrix.needsUpdate = true;});
  });
  const rows = Math.ceil(count/105);
  return <group name="living-crowd">
    {Array.from({length:rows},(_,row) => <group key={row}>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,.397+row*.62,0]} receiveShadow><ringGeometry args={[13.35+row*1.05,14.42+row*1.05,112]} /><meshStandardMaterial color={row%2 ? '#373b40' : '#42464b'} roughness={.95} side={DoubleSide}/></mesh>
      <mesh position={[0,.09+row*.62,0]}><cylinderGeometry args={[13.35+row*1.05,13.35+row*1.05,.62,112,1,true]}/><meshStandardMaterial color="#23282e" roughness={.9} side={DoubleSide}/></mesh>
    </group>)}
    {groups.map(({geometry,material,fans},index) => fans.length > 0 && <instancedMesh key={index}
      ref={instance => {if(instance) instances.current.set(index,instance); else instances.current.delete(index);}}
      args={[geometry,material,fans.length]} frustumCulled={false}/>) }
    {propCounts.map((total,index) => total > 0 && <instancedMesh key={`prop-${index}`} name={index===8?'crowd-lighters':`crowd-sign-${index}`}
      ref={instance => {if(instance) props.current.set(index,instance); else props.current.delete(index);}}
      args={[undefined,undefined,total]} frustumCulled={false}>
      {index===8 ? <sphereGeometry args={[1,6,4]}/> : <boxGeometry args={[1,1,1]}/>}
      {index===8 ? <meshBasicMaterial color="#ffd995"/> : <meshStandardMaterial map={textures[index]} roughness={1}/>}
    </instancedMesh>)}
  </group>;
}
