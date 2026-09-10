import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import console from 'node:console';
import { AnimationMixer, Vector3 } from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const file = process.argv[2];
const step = Number(process.argv[3] ?? .4);
if (!file) throw new Error('Usage: node tools/animations/inspect-combat.mjs source.fbx [sample interval]');
const bytes = readFileSync(file);
const scene = new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const clip = scene.animations[0];
const mixer = new AnimationMixer(scene); mixer.clipAction(clip).play();
const names = ['Hips', 'Spine2', 'Head', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];
const frames = [];
for (let time = 0; time < clip.duration; time += step) {
  mixer.setTime(time); scene.updateMatrixWorld(true);
  const points = Object.fromEntries(names.map(name => [name, scene.getObjectByName(`mixamorig${name}`).getWorldPosition(new Vector3()).toArray()]));
  frames.push({ time, points });
}
writeFileSync('/tmp/frwf-source-motion.json', JSON.stringify({ file, duration: clip.duration, frames }));
console.log({ file, duration: clip.duration, frames: frames.length, output: '/tmp/frwf-source-motion.json' });
