import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { CanvasTexture, DoubleSide, InstancedBufferAttribute, Mesh, type MeshStandardMaterial, Object3D, SRGBColorSpace, Vector3, type InstancedMesh } from 'three';
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
    ctx.fillStyle = ['#d8bd88','#eff09b','#e6ded0','#e6adb8'][index % 4] ?? '#d8bd88'; ctx.fillRect(0,0,512,288);
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
    });
  },[gltf,count]);
  const propCounts = useMemo(() => {
    const counts = Array<number>(9).fill(0);
    groups.forEach(group => group.fans.forEach(fan => { if(fan.prop < .22) {const slot = fan.prop < .15 ? fan.message : 8; counts[slot] = (counts[slot] ?? 0) + 1;} }));
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
          propDummy.position.set(sign ? 0 : (anatomy.rightShoulder[0] ?? 0) + Math.sin(arms.right)*armLength,
            (anatomy.rightShoulder[1] ?? 1.5) - Math.cos(sign ? 2.75 : arms.right)*armLength + (sign ? .17 : .025), .045);
          propDummy.rotation.set(0,0,0); propDummy.scale.set(sign ? .85 : .026,sign ? .48 : .06,sign ? .026 : .026);
          propDummy.updateMatrix(); propDummy.matrix.premultiply(dummy.matrix);
          propMesh?.setMatrixAt((cursors[slot] ?? 0),propDummy.matrix); cursors[slot] = (cursors[slot] ?? 0) + 1;
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
