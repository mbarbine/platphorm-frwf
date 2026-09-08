import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { AnimationMixer, Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const source = process.argv[2];
if (!source) throw new Error('Usage: node tools/animations/import-combat.mjs /path/to/Combat');
const specifications = [
  { id: 'fighting_idle', file: 'FightingIdle_mixamo.fbx', start: 1, end: 4, contact: null },
  { id: 'jab', file: 'Boxing_mixamo.fbx', start: 1.83, end: 2.29, contact: 2.1 },
  { id: 'combo', file: 'Boxing_mixamo.fbx', start: 2.23, end: 2.68, contact: 2.4 },
  { id: 'front_kick', file: 'BigFrontKick_mixamo.fbx', start: 3.48, end: 4.48, contact: 4 },
  { id: 'roundhouse', file: 'RoundHouseKick_mixamo.fbx', start: 7.15, end: 8.45, contact: 7.85 },
];
const clips = {};
const round = x => Number(x.toFixed(5));
const euler = q => new Euler().setFromQuaternion(q, 'XYZ').toArray().slice(0, 3).map(round);
const quat = (x, y) => {
  const z = new Vector3().crossVectors(x, y).normalize();
  x = new Vector3().crossVectors(y, z).normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
};
for (const spec of specifications) {
  const bytes = readFileSync(resolve(source, spec.file));
  const scene = new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const mixer = new AnimationMixer(scene); mixer.clipAction(scene.animations[0]).play();
  const position = name => {
    const bone = scene.getObjectByName(`mixamorig${name}`);
    if (!bone) throw new Error(`${spec.file} is missing ${name}`);
    const value = bone.getWorldPosition(new Vector3());
    // Source Left is +X; the FRWF contact skeleton has Left at -X.
    value.x *= -1; return value;
  };
  const duration = spec.end - spec.start;
  const frames = [];
  let heading;
  for (let index = 0; index <= Math.ceil(duration * 30); index++) {
    const time = Math.min(duration, index / 30);
    mixer.setTime(spec.start + time); scene.updateMatrixWorld(true);
    const hips = position('Hips');
    const hipRight = position('RightUpLeg').sub(position('LeftUpLeg')).normalize();
    const up = position('Spine').sub(hips).normalize();
    const root = quat(hipRight, up);
    if (!heading) {
      const forward = new Vector3(0, 0, 1).applyQuaternion(root);
      heading = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -Math.atan2(forward.x, forward.z));
    }
    const chest = quat(position('RightArm').sub(position('LeftArm')).normalize(), position('Neck').sub(position('Spine1')).normalize());
    const rootAngles = euler(heading.clone().multiply(root));
    const pose = {
      torso: euler(root.clone().invert().multiply(chest)),
      rootX: 0, rootY: 0, rootZ: 0,
      rootTilt: rootAngles[0], rootYaw: rootAngles[1], rootRoll: rootAngles[2],
    };
    for (const side of ['Left', 'Right']) {
      const lower = side.toLowerCase();
      for (const limb of ['Arm', 'Leg']) {
        const a = position(`${side}${limb === 'Arm' ? 'Arm' : 'UpLeg'}`);
        const b = position(`${side}${limb === 'Arm' ? 'ForeArm' : 'Leg'}`);
        const c = position(`${side}${limb === 'Arm' ? 'Hand' : 'Foot'}`);
        const upper = b.sub(a).normalize(); const child = c.sub(position(`${side}${limb === 'Arm' ? 'ForeArm' : 'Leg'}`)).normalize();
        const angle = upper.angleTo(child);
        const axis = limb === 'Arm' ? new Vector3().crossVectors(child, upper) : new Vector3().crossVectors(upper, child);
        if (axis.lengthSq() < .0025) axis.copy(hipRight).addScaledVector(upper, -hipRight.dot(upper));
        const rotation = quat(axis.normalize(), upper.clone().negate());
        const parent = limb === 'Arm' ? chest : root;
        pose[`${lower}${limb}`] = euler(parent.clone().invert().multiply(rotation));
        pose[`${lower}${limb === 'Arm' ? 'Forearm' : 'Shin'}`] = [-round(Math.min(limb === 'Arm' ? 2.65 : 2.45, angle)), 0, 0];
      }
    }
    frames.push({ time: round(time), pose });
  }
  clips[spec.id] = { source: spec.file, sourceSha256: createHash('sha256').update(bytes).digest('hex'), sourceStart: spec.start, sourceEnd: spec.end, duration: round(duration), contact: spec.contact === null ? null : round(spec.contact - spec.start), fps: 30, frames };
}
const inventory = readdirSync(source).filter(file => file.endsWith('.fbx')).sort().map(file => {
  const bytes = readFileSync(resolve(source, file));
  return { file: basename(file), sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, importedClips: specifications.filter(spec => spec.file === file).map(spec => spec.id) };
});
mkdirSync('src/game/animation/generated', { recursive: true });
writeFileSync('src/game/animation/generated/combat-motions.json', JSON.stringify({ version: 1, provenance: 'User supplied Combat FBX files; names identify Mixamo. Original source files remain outside the public bundle.', inventory, clips }) + '\n');
console.log(`Imported ${Object.keys(clips).length} trimmed physical pose clips; catalogued ${inventory.length} source files.`);
