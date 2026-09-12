import { URL } from 'node:url';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { FIGHTERS } from '../../src/game/data/fighters.ts';
import { Bone, BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute, Skeleton, SkinnedMesh, MeshStandardMaterial, Group, Vector3, Color, SphereGeometry, Mesh, Quaternion } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
};
const source = new URL('../../assets/characters/makehuman/', import.meta.url);
const read = name => readFileSync(new URL(name, source), 'utf8');
const rig = JSON.parse(read('default.mhskel'));
const weights = JSON.parse(read('default_weights.mhw')).weights;
const vertices = []; const faces = []; const texcoords = []; const uvFaces = []; let group = '';
for (const line of read('base.obj').split('\n')) {
  const a = line.trim().split(/\s+/);
  if (a[0] === 'v') vertices.push(a.slice(1).map(Number));
  if (a[0] === 'vt') texcoords.push(a.slice(1).map(Number));
  if (a[0] === 'g') group = a[1];
  if (a[0] === 'f' && group === 'body') {
    const indices = a.slice(1).map(v => Number(v.split('/')[0]) - 1);
    const uvs = a.slice(1).map(v=>Number(v.split('/')[1])-1);
    for (let i = 1; i < indices.length - 1; i++) { faces.push([indices[0], indices[i], indices[i+1]]); uvFaces.push([uvs[0],uvs[i],uvs[i+1]]); }
  }
}
const mpfbSource = new URL('../../assets/characters/mpfb/', import.meta.url);
const provenance = JSON.parse(readFileSync(new URL('provenance.json', mpfbSource), 'utf8'));
const phenotypes = JSON.parse(readFileSync(new URL('phenotypes.json', import.meta.url), 'utf8'));
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
const profiles = FIGHTERS.map(fighter => ({ id: fighter.id, height: fighter.physics.standingHeightM, width: 1, skin: fighter.palette.skin, gear: fighter.palette.secondary, accent: fighter.palette.emissive, tattoo: phenotypes[fighter.id].tattoo }));
const shirts = ['#923b3a','#36516c','#d0b475','#35594b','#70466c','#c2b5a5'];
const skins = ['#b98163','#84573f','#5a3d30','#d4a480','#b98d72','#724e3e'];
for (let i=0;i<12;i++) profiles.push({id:`crowd-${i}`, crowd:true, width:1,skin:skins[i%skins.length],gear:shirts[i%shirts.length],accent:'#303744',tattoo:'none'});
const crowdAnatomy = {};
const crowdScene = new Group(); crowdScene.name = 'MPFB-Crowd';
const output = new URL('../../public/characters/', import.meta.url); mkdirSync(output, {recursive:true});
const manifest = {version:2,license:'CC0-1.0',source:provenance.source,revision:provenance.revision,authoring:{mpfb:provenance.version,blender:provenance.blender},generator:'tools/characters/build-human-assets.mjs',motionCaptureIncluded:false,fighters:[]};
for (const profile of profiles) {
  const points = JSON.parse(gunzipSync(readFileSync(new URL(`${profile.id}.json.gz`, mpfbSource))));
  if (points.length !== vertices.length) throw new Error(`MPFB topology mismatch: ${profile.id}`);
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
  const wrists = ['L', 'R'].map(side => bonePoint(`wrist.${side}`, 'head'));
  const knees = ['L', 'R'].map(side => bonePoint(`lowerleg01.${side}`, 'head'));
  const uv=[], positions=[], skinIndices=[], skinWeights=[], colors=[], indices=[]; const remap=new Map();
  const skin=new Color(profile.skin), gear=new Color(profile.gear), accent=new Color(profile.accent);
  for (let faceIndex=0; faceIndex<faces.length; faceIndex++) {
    const face = faces[faceIndex];
    for(const corner of [0,2,1]) {
      const original = face[corner]; const uvIndex = uvFaces[faceIndex][corner]; const key = `${original}/${uvIndex}`;
      if(!remap.has(key)) {
        remap.set(key,positions.length/3); uv.push(...texcoords[uvIndex]); const pos=p[original]; positions.push(...pos.toArray());
        const w=[...merged[original]].sort((a,b)=>b[1]-a[1]).slice(0,4); const sum=w.reduce((s,e)=>s+e[1],0)||1;
        for(let k=0;k<4;k++){skinIndices.push(w[k]?.[0]??0);skinWeights.push(w[k]?w[k][1]/sum:k===0&&w.length===0?1:0);}
        const dominant=names[w[0]?.[0]??0]; const originalY=points[original][1];
        const waist = bones[names.indexOf('abdomen')].position.y + .03;
        const hem = Math.max(...knees.map(k=>k.y)) + (profile.id === 'chad' ? .09 : .19);
        const trunks=/^(pelvis|abdomen|leftThigh|rightThigh)$/.test(dominant) && pos.y > hem && pos.y < waist;
        const boot=dominant.includes('Foot')||(dominant.includes('Shin')&&originalY < -5.1);
        // Wrap the anatomical wrist in the skin itself, so the tape bends
        // with the same weights rather than floating around a collider.
        const tape=/Forearm|Hand/.test(dominant)&&wrists.some(wrist=>pos.distanceTo(wrist)<.047);
        const kneePad=/Thigh|Shin/.test(dominant)&&knees.some(knee=>Math.abs(pos.y-knee.y)<.095);
        const trim=trunks&&(pos.y > waist-.035 || Math.abs(pos.x)>.21*profile.width);
        const col=(trim?accent:trunks||boot?gear:kneePad?new Color('#20252d'):tape?new Color('#d8d4c9'):skin).clone();
        if (profile.crowd) {
          if (/pelvis|Thigh|Shin|Foot/.test(dominant)) col.copy(accent);
          else if (/abdomen|chest|UpperArm/.test(dominant)) col.copy(gear);
        } else {
          // Ink is part of the deforming skin, never a floating decal around a collider.
          const arm = /UpperArm|Forearm/.test(dominant);
          const band = Math.sin(pos.y * 105 + Math.atan2(pos.z, Math.abs(pos.x) - .28) * 3);
          if (arm && profile.tattoo === 'forearms' && /Forearm/.test(dominant) && band > -.05) col.lerp(new Color('#20312e'), .82);
          if (arm && profile.tattoo === 'shoulder' && dominant === 'leftUpperArm' && Math.sin(pos.y * 63 + pos.z * 58) > .12) col.lerp(new Color('#26322e'), .78);
        }
        const variation=1+Math.sin(original*12.9898)*.012; col.multiplyScalar(variation);colors.push(...(profile.crowd ? col.toArray() : [1,1,1]));
      }
      indices.push(remap.get(key));
    }
  }
  // Eye whites and irises use the same skinned head bone as the face.
  for (const side of ['L','R']) {
    const center=bonePoint(`eye.${side}`,'head');
    for(const [radius,offset,color] of [[.013,0,'#e9e5dc'],[.0065,.012,'#383025'],[.003,.017,'#090b10']]) {
      const eye=new SphereGeometry(radius,16,10); const start=positions.length/3; const attribute=eye.getAttribute('position');const col=new Color(color);
      for(let i=0;i<attribute.count;i++){positions.push(center.x+attribute.getX(i),center.y+attribute.getY(i),center.z+offset+attribute.getZ(i));colors.push(...col.toArray());uv.push(0,0);skinIndices.push(3,0,0,0);skinWeights.push(1,0,0,0);}
      indices.push(...Array.from(eye.index.array,n=>n+start));eye.dispose();
    }
  }
  // Sculpted boots conceal the base mesh's bare toes; pads follow knee skinning.
  for(const side of ['left','right']) {
    const foot=bones[names.indexOf(side+'Foot')].position;
    const nativeSpan = bones[3].position.y - foot.y;
    const fitScale = profile.crowd ? 1 : (2.08 * profile.height / 1.88 - .1) / nativeSpan;
    const boot=new SphereGeometry(1,24,16);const attr=boot.getAttribute('position');const start=positions.length/3;const col=new Color('#151b23');
    for(let i=0;i<attr.count;i++){positions.push(foot.x+Math.sign(attr.getX(i))*Math.pow(Math.abs(attr.getX(i)),.48)*(.098 + .006*attr.getZ(i))/fitScale,foot.y+Math.max(-.061,attr.getY(i)*.09)/fitScale,foot.z+(.09+Math.sign(attr.getZ(i))*Math.pow(Math.abs(attr.getZ(i)),.48)*.214)/fitScale);colors.push(...col.toArray());uv.push(0,0);skinIndices.push(names.indexOf(side+'Foot'),0,0,0);skinWeights.push(1,0,0,0);}
    indices.push(...(boot.index ? Array.from(boot.index.array,n=>n+start) : Array.from({length:attr.count},(_,i)=>i+start)));boot.dispose();
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));geometry.setAttribute('color',new Float32BufferAttribute(colors,3));geometry.setAttribute('skinIndex',new Uint16BufferAttribute(skinIndices,4));geometry.setAttribute('skinWeight',new Float32BufferAttribute(skinWeights,4));geometry.setIndex(indices);geometry.computeVertexNormals();
  const material=new MeshStandardMaterial({vertexColors:true,roughness:.62,metalness:.02});material.name='skin-and-ring-gear';
  const mesh=new SkinnedMesh(geometry,material);mesh.name=profile.id;const scene=new Group();scene.name='FRWF-Humanoid';scene.add(mesh,...bones);scene.updateMatrixWorld(true);
  for (const side of ['left','right']) for(let f=1;f<=5;f++) for(let l=1;l<=3;l++) {
    const child=bones[names.indexOf(`${side}${fingerNames[f-1]}${l}`)];
    const parent=bones[names.indexOf(l===1?side+'Hand':`${side}${fingerNames[f-1]}${l-1}`)];parent.attach(child);
  }
  scene.updateMatrixWorld(true);const skeleton=new Skeleton(bones);mesh.bind(skeleton);
  if (phenotypes[profile.id]?.hair) {
    const part=JSON.parse(gunzipSync(readFileSync(new URL(`${profile.id}-hair.json.gz`,mpfbSource))));
    const positions=[], uv=[], skinIndex=[], skinWeight=[];
    // Both the OBJ body and fitted MHCLO part use the same reflected coordinates.
    for (let t=0;t<part.positions.length;t+=3) for(const corner of [0,2,1]) {
      const v=part.positions[t+corner]; positions.push(-v[0]*.1,(v[1]-floor)*.1,v[2]*.1); uv.push(...part.uv[t+corner]); skinIndex.push(3,0,0,0);skinWeight.push(1,0,0,0);
    }
    const hairGeometry=new BufferGeometry();hairGeometry.setAttribute('position',new Float32BufferAttribute(positions,3));hairGeometry.setAttribute('uv',new Float32BufferAttribute(uv,2));hairGeometry.setAttribute('skinIndex',new Uint16BufferAttribute(skinIndex,4));hairGeometry.setAttribute('skinWeight',new Float32BufferAttribute(skinWeight,4));hairGeometry.computeVertexNormals();
    const hairMaterial=new MeshStandardMaterial({roughness:.92,alphaTest:.45,side:2});hairMaterial.name='hair';
    const hairMesh=new SkinnedMesh(hairGeometry,hairMaterial);hairMesh.name=profile.id+'-hair';scene.add(hairMesh);hairMesh.bind(skeleton);
  }
  if (profile.crowd) {
    // Relax both complete arm chains about their shoulder, then bake once for instancing.
    for (const side of ['left','right']) {
      const shoulder = bonePoint(`upperarm01.${side === 'left' ? 'L' : 'R'}`, 'head');
      const upper = bones[names.indexOf(side+'UpperArm')];
      const target = new Quaternion().setFromAxisAngle(new Vector3(0,0,1), side === 'left' ? -.12 : .12);
      const delta = target.multiply(upper.quaternion.clone().invert());
      for (const suffix of ['UpperArm','Forearm','Hand']) {
        const bone = bones[names.indexOf(side+suffix)];
        bone.position.sub(shoulder).applyQuaternion(delta).add(shoulder); bone.quaternion.premultiply(delta);
      }
    }
    scene.updateMatrixWorld(true); skeleton.update();
    const baked = geometry.clone(); const attribute = baked.getAttribute('position'); const point = new Vector3();
    for(let i=0;i<attribute.count;i++) { point.fromBufferAttribute(attribute,i); mesh.applyBoneTransform(i,point); attribute.setXYZ(i,point.x,point.y,point.z); }
    const armWeights = [];
    for (let i = 0; i < attribute.count; i++) {
      let left = 0; let right = 0;
      for (let j = 0; j < 4; j++) {
        const bone = names[skinIndices[i * 4 + j]];
        if (/UpperArm|Forearm|Hand|Thumb|Index|Middle|Ring|Little/.test(bone)) {
          if (bone.startsWith('left')) left += skinWeights[i * 4 + j]; else right += skinWeights[i * 4 + j];
        }
      }
      armWeights.push(left, right);
    }
    baked.setAttribute('uv', new Float32BufferAttribute(armWeights, 2));
    baked.deleteAttribute('skinIndex'); baked.deleteAttribute('skinWeight'); baked.computeVertexNormals();
    crowdAnatomy[profile.id] = { leftShoulder: bonePoint('upperarm01.L','head').toArray(), rightShoulder: bonePoint('upperarm01.R','head').toArray(), headY: bones[3].position.y };
    const pieces = [baked];
    const headCenter = bones[3].position;
    const variant = Number(profile.id.split('-')[1]);
    const addHair = (beard) => {
      const patch = new SphereGeometry(1, 14, 10, 0, beard ? Math.PI : Math.PI * 2, beard ? Math.PI * .4 : 0, beard ? Math.PI * .57 : Math.PI * .5);
      const a = patch.getAttribute('position'); const shade = new Color(variant % 4 === 0 ? '#77716a' : variant % 3 === 0 ? '#8a5634' : '#29211e');
      const tint = [];
      for (let i=0;i<a.count;i++) { a.setXYZ(i, headCenter.x+a.getX(i)*.085,headCenter.y+(beard?-.06:.055)+a.getY(i)*(beard?.13:.09),headCenter.z+(beard?.027:0)+a.getZ(i)*.096); tint.push(...shade.toArray()); }
      patch.setAttribute('uv',new Float32BufferAttribute(new Float32Array(a.count*2),2)); patch.setAttribute('color',new Float32BufferAttribute(tint,3)); patch.computeVertexNormals(); pieces.push(patch);
    };
    if (variant % 5 !== 0) addHair(false);
    const macro = provenance.characters.find(c=>c.id===profile.id).phenotype;
    if (macro.gender > .5 && variant % 3 !== 1) addHair(true);
    const staticBody = new Mesh(mergeGeometries(pieces), material); staticBody.name = profile.id; crowdScene.add(staticBody);
    continue;
  }
  const glb=await new GLTFExporter().parseAsync(scene,{binary:true});const data=Buffer.from(glb);const sha256=createHash('sha256').update(data).digest('hex');const filename=`${profile.id}.${sha256.slice(0,12)}.glb`;writeFileSync(new URL(filename,output),data);
  const eyeCenter=bonePoint('eye.L','head').add(bonePoint('eye.R','head')).multiplyScalar(.5);
  const faceOffset=eyeCenter.sub(bones[3].position).toArray();
  manifest.fighters.push({faceOffset,id:profile.id,url:`/characters/${filename}`,sha256,bytes:data.length,triangles:indices.length/3,bones:names});console.log(profile.id,data.length,indices.length/3);
}
const existingManifest = new URL('manifest.json',output);
// Keep the current crowd usable during an incremental authoring rebuild.
if (existsSync(existingManifest)) {
  const previous = JSON.parse(readFileSync(existingManifest, 'utf8'));
  if (previous.crowd) manifest.crowd = previous.crowd;
}
writeFileSync(existingManifest,JSON.stringify(manifest,null,2)+'\n');

const crowdData=Buffer.from(await new GLTFExporter().parseAsync(crowdScene,{binary:true}));
writeFileSync(new URL('crowd-source.glb',output),crowdData);
writeFileSync(new URL('crowd-anatomy.json',mpfbSource),JSON.stringify(crowdAnatomy,null,2)+'\n');
