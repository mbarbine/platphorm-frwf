import { URL } from 'node:url';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Bone, BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute, Skeleton, SkinnedMesh, MeshStandardMaterial, Group, Vector3, Color, SphereGeometry } from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
};
const source = new URL('../../assets/characters/makehuman/', import.meta.url);
const read = name => readFileSync(new URL(name, source), 'utf8');
const rig = JSON.parse(read('default.mhskel'));
const weights = JSON.parse(read('default_weights.mhw')).weights;
const vertices = []; const faces = []; let group = '';
for (const line of read('base.obj').split('\n')) {
  const a = line.trim().split(/\s+/);
  if (a[0] === 'v') vertices.push(a.slice(1).map(Number));
  if (a[0] === 'g') group = a[1];
  if (a[0] === 'f' && group === 'body') {
    const indices = a.slice(1).map(v => Number(v.split('/')[0]) - 1);
    for (let i = 1; i < indices.length - 1; i++) faces.push([indices[0], indices[i], indices[i+1]]);
  }
}
const targets = ['male.target', 'muscle.target'].map(name => read(name).split('\n').filter(l => l && !l.startsWith('#')).map(l => l.trim().split(/\s+/).map(Number)));
const names = ['pelvis','abdomen','chest','head','leftUpperArm','rightUpperArm','leftForearm','rightForearm','leftHand','rightHand','leftThigh','rightThigh','leftShin','rightShin','leftFoot','rightFoot'];
const fingerNames = ['Thumb','Index','Middle','Ring','Little'];
for (const side of ['left','right']) for(let finger=1;finger<=5;finger++) for(let link=1;link<=3;link++) names.push(`${side}${fingerNames[finger-1]}${link}`);
function segment(name) {
  const side = name.endsWith('.L') ? 'left' : 'right';
  const finger = name.match(/^finger([1-5])-([1-3])/);
  if(finger) return `${side}${fingerNames[Number(finger[1])-1]}${finger[2]}`;
  if (/upperarm/.test(name)) return side+'UpperArm';
  if (/lowerarm/.test(name)) return side+'Forearm';
  if (/wrist|finger|metacarpal/.test(name)) return side+'Hand';
  if (/upperleg/.test(name)) return side+'Thigh';
  if (/lowerleg/.test(name)) return side+'Shin';
  if (/foot|toe/.test(name)) return side+'Foot';
  if (/pelvis|root|spine0[45]/.test(name)) return 'pelvis';
  if (/spine03/.test(name)) return 'abdomen';
  if (/spine0[12]|breast|clavicle|shoulder/.test(name)) return 'chest';
  return 'head';
}
const merged = vertices.map(() => new Map());
for (const [bone, entries] of Object.entries(weights)) {
  const index = names.indexOf(segment(bone));
  for (const [vertex, weight] of entries) merged[vertex].set(index, (merged[vertex].get(index) ?? 0) + weight);
}
const profiles = [
  {id:'atlas',muscle:1.8,width:1.2,skin:'#a9654c',gear:'#35182f',accent:'#ffcc33'},
  {id:'vex',muscle:.45,width:.88,skin:'#7e513f',gear:'#20364a',accent:'#50f7ff'},
  {id:'nova',muscle:.65,width:.96,skin:'#d39a77',gear:'#181734',accent:'#b77bff'},
  {id:'brick',muscle:.85,width:1.04,skin:'#553a32',gear:'#1b2735',accent:'#41b8ff'},
  {id:'chad',muscle:1.1,width:1.15,skin:'#c58c70',gear:'#66717d',accent:'#e5e7e9'},
];
const output = new URL('../../public/characters/', import.meta.url); mkdirSync(output, {recursive:true});
const manifest = {version:1,license:'CC0-1.0',source:'https://github.com/makehumancommunity/makehuman',revision:'a8bc2d54ff0ac92e78ff71431b1023eda42bf482',generator:'tools/characters/build-human-assets.mjs',motionCaptureIncluded:false,fighters:[]};
for (const profile of profiles) {
  const points = vertices.map(v => [...v]);
  targets.forEach((target,t) => { for (const [i,x,y,z] of target) {const strength=t===0?1:profile.muscle; points[i][0]+=x*strength; points[i][1]+=y*strength; points[i][2]+=z*strength;} });
  const floor = Math.min(...faces.flat().map(i=>points[i][1]));
  // MakeHuman left is +X; Ringfall's canonical left is -X. Flip winding below.
  const p = points.map(v => new Vector3(-v[0]*.1*profile.width,(v[1]-floor)*.1,v[2]*.1));
  const joint = name => rig.joints[name].reduce((v,i)=>v.add(p[i]),new Vector3()).divideScalar(rig.joints[name].length);
  const bonePoint = (name,end) => joint(rig.bones[name][end]);
  const definitions = {
    pelvis:['spine05','head','spine04','tail'], abdomen:['spine03','head','spine02','head'], chest:['spine02','head','spine01','tail'], head:['head','head','head','tail'],
  };
  for (const side of ['left','right']) { const s=side==='left'?'L':'R'; Object.assign(definitions,{
    [side+'UpperArm']:[`upperarm01.${s}`,'head',`upperarm02.${s}`,'tail'],
    [side+'Forearm']:[`lowerarm01.${s}`,'head',`lowerarm02.${s}`,'tail'],
    [side+'Hand']:[`wrist.${s}`,'head',`finger3-1.${s}`,'tail'],
    [side+'Thigh']:[`upperleg01.${s}`,'head',`upperleg02.${s}`,'tail'],
    [side+'Shin']:[`lowerleg01.${s}`,'head',`lowerleg02.${s}`,'tail'],
    [side+'Foot']:[`foot.${s}`,'head',`foot.${s}`,'tail'],
  }); }
  for (const side of ['left','right']) for(let f=1;f<=5;f++) for(let l=1;l<=3;l++) {
    const native=`finger${f}-${l}.${side==='left'?'L':'R'}`;
    definitions[`${side}${fingerNames[f-1]}${l}`]=[native,'head',native,'tail'];
  }
  const bones = names.map(name=>{
    const [a,b,c,d]=definitions[name]; const head=bonePoint(a,b),tail=bonePoint(c,d); const bone=new Bone();bone.name=name;
    if(/Thumb|Index|Middle|Ring|Little/.test(name)) bone.position.copy(head);
    else bone.position.copy(head).add(tail).multiplyScalar(.5);
    if (!['pelvis','abdomen','chest','head'].includes(name) && !name.includes('Foot')) bone.quaternion.setFromUnitVectors(new Vector3(0,1,0),head.clone().sub(tail).normalize());
    return bone;
  });
  const positions=[], skinIndices=[], skinWeights=[], colors=[], indices=[]; const remap=new Map();
  const skin=new Color(profile.skin), gear=new Color(profile.gear), accent=new Color(profile.accent);
  for (const face of faces) {
    const sorted = [face[0],face[2],face[1]];
    for(const original of sorted) {
      if(!remap.has(original)) {
        remap.set(original,positions.length/3); const pos=p[original]; positions.push(...pos.toArray());
        const w=[...merged[original]].sort((a,b)=>b[1]-a[1]).slice(0,4); const sum=w.reduce((s,e)=>s+e[1],0)||1;
        for(let k=0;k<4;k++){skinIndices.push(w[k]?.[0]??0);skinWeights.push(w[k]?w[k][1]/sum:k===0&&w.length===0?1:0);}
        const dominant=names[w[0]?.[0]??0]; const originalY=points[original][1];
        const trunks=originalY>(profile.id==='chad'?-2.0:-.9)&&originalY<2.1&&!dominant.includes('Arm')&&!dominant.includes('Hand');
        const boot=dominant.includes('Foot')||(dominant.includes('Shin')&&originalY < -5.1);
        const tape=dominant.includes('Forearm')&&originalY<3.0&&originalY>2.5;
        const trim=trunks&&(originalY>1.75||Math.abs(pos.x)>.2*profile.width);
        const col=(trim?accent:trunks||boot?gear:tape?new Color('#d8d4c9'):skin).clone();
        const variation=1+Math.sin(original*12.9898)*.012; col.multiplyScalar(variation);colors.push(...col.toArray());
      }
      indices.push(remap.get(original));
    }
  }
  // Eye whites and irises use the same skinned head bone as the face.
  for (const side of ['L','R']) {
    const center=bonePoint(`eye.${side}`,'head');
    for(const [radius,offset,color] of [[.013,0,'#e9e5dc'],[.0065,.012,'#383025'],[.003,.017,'#090b10']]) {
      const eye=new SphereGeometry(radius,16,10); const start=positions.length/3; const attribute=eye.getAttribute('position');const col=new Color(color);
      for(let i=0;i<attribute.count;i++){positions.push(center.x+attribute.getX(i),center.y+attribute.getY(i),center.z+offset+attribute.getZ(i));colors.push(...col.toArray());skinIndices.push(3,0,0,0);skinWeights.push(1,0,0,0);}
      indices.push(...Array.from(eye.index.array,n=>n+start));eye.dispose();
    }
  }
  // Sculpted boots conceal the base mesh's bare toes; pads follow knee skinning.
  for(const side of ['left','right']) {
    const foot=bones[names.indexOf(side+'Foot')].position;
    const boot=new SphereGeometry(1,18,12);const attr=boot.getAttribute('position');const start=positions.length/3;const col=new Color('#151b23');
    for(let i=0;i<attr.count;i++){positions.push(foot.x+attr.getX(i)*.064,foot.y+attr.getY(i)*.045,foot.z+.07+attr.getZ(i)*.145);colors.push(...col.toArray());skinIndices.push(names.indexOf(side+'Foot'),0,0,0);skinWeights.push(1,0,0,0);}
    indices.push(...Array.from(boot.index.array,n=>n+start));boot.dispose();
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('color',new Float32BufferAttribute(colors,3));geometry.setAttribute('skinIndex',new Uint16BufferAttribute(skinIndices,4));geometry.setAttribute('skinWeight',new Float32BufferAttribute(skinWeights,4));geometry.setIndex(indices);geometry.computeVertexNormals();
  const material=new MeshStandardMaterial({vertexColors:true,roughness:.62,metalness:.02});material.name='skin-and-ring-gear';
  const mesh=new SkinnedMesh(geometry,material);mesh.name=profile.id;const scene=new Group();scene.name='FRWF-Humanoid';scene.add(mesh,...bones);scene.updateMatrixWorld(true);
  for (const side of ['left','right']) for(let f=1;f<=5;f++) for(let l=1;l<=3;l++) {
    const child=bones[names.indexOf(`${side}${fingerNames[f-1]}${l}`)];
    const parent=bones[names.indexOf(l===1?side+'Hand':`${side}${fingerNames[f-1]}${l-1}`)];parent.attach(child);
  }
  scene.updateMatrixWorld(true);const skeleton=new Skeleton(bones);mesh.bind(skeleton);
  const glb=await new GLTFExporter().parseAsync(scene,{binary:true});const data=Buffer.from(glb);const sha256=createHash('sha256').update(data).digest('hex');const filename=`${profile.id}.${sha256.slice(0,12)}.glb`;writeFileSync(new URL(filename,output),data);
  const eyeCenter=bonePoint('eye.L','head').add(bonePoint('eye.R','head')).multiplyScalar(.5);
  const faceOffset=eyeCenter.sub(bones[3].position).toArray();
  manifest.fighters.push({faceOffset,id:profile.id,url:`/characters/${filename}`,sha256,bytes:data.length,triangles:indices.length/3,bones:names});console.log(profile.id,data.length,indices.length/3);
}
writeFileSync(new URL('manifest.json',output),JSON.stringify(manifest,null,2)+'\n');
