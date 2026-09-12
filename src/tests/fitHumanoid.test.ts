// @vitest-environment node
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { Bone, Group, Vector3, type SkinnedMesh } from 'three';
import { fitHumanoid } from '../game/presentation/fitHumanoid';
import { buildBodySchema } from '../game/physics/bodySchema';
import { fighterById } from '../game/data/fighters';
import type { FighterId } from '../game/types/game';
import manifest from '../../public/characters/manifest.json';

describe('canonical humanoid scale', () => {
  it.each(manifest.fighters)('fits $id to contact landmarks without mutating the cached asset', async asset => {
    const bytes = readFileSync(resolve(import.meta.dirname, `../../public${asset.url}`));
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const gltf = await new GLTFLoader().parseAsync(buffer, '');
    const sourceHead = gltf.scene.getObjectByName('head')?.position.y;
    const meshName = ('sharedAssetFrom' in asset ? asset.sharedAssetFrom : undefined) ?? asset.id;
    const source = gltf.scene.getObjectByName(meshName) as SkinnedMesh;
    const originalY = source.geometry.getAttribute('position').getY(0);
    const instance = clone(gltf.scene);
    const fit = fitHumanoid(instance, asset.id as FighterId);
    const schema = buildBodySchema(fighterById(asset.id as FighterId));
    const targetSpan = (schema.find(s => s.id === 'head')?.localPosition[1] ?? 0) - (schema.find(s => s.id === 'leftFoot')?.localPosition[1] ?? 0);
    expect((instance.getObjectByName('head')?.position.y ?? 0) - (instance.getObjectByName('leftFoot')?.position.y ?? 0)).toBeCloseTo(targetSpan, 4);
    expect(gltf.scene.getObjectByName('head')?.position.y).toBe(sourceHead);
    expect(source.geometry.getAttribute('position').getY(0)).toBe(originalY);
    const fitted = instance.getObjectByName(meshName) as SkinnedMesh;
    expect(fitted.geometry).not.toBe(source.geometry);
    expect(fit.scale).toBeGreaterThan(1);
    fitted.skeleton.update();
    const matrices = fitted.skeleton.boneMatrices;
    if (!matrices) throw new Error('Fitted skeleton has no bone matrices');
    expect([...matrices].every(Number.isFinite)).toBe(true);
    // Rebinding the rest pose must not stretch an otherwise unchanged vertex.
    expect(matrices[0]).toBeCloseTo(1, 4);
    fit.dispose();
  });
});


it('fits nested canonical landmarks using their world height rather than local offsets', () => {
  const scene = new Group(); const pelvis = new Bone(); const chest = new Bone();
  const head = new Bone(); head.name = 'head'; const left = new Bone(); left.name = 'leftFoot';
  const right = new Bone(); right.name = 'rightFoot';
  scene.add(pelvis); pelvis.add(chest, left, right); chest.add(head);
  pelvis.position.y = 1; chest.position.y = .7; head.position.y = .4;
  left.position.set(-.2, -1, 0); right.position.set(.2, -1, 0);
  const fit = fitHumanoid(scene, 'dale');
  const schema = buildBodySchema(fighterById('dale'));
  const targetSpan = (schema.find(s => s.id === 'head')?.localPosition[1] ?? 0) - (schema.find(s => s.id === 'leftFoot')?.localPosition[1] ?? 0);
  expect(head.getWorldPosition(new Vector3()).y - left.getWorldPosition(new Vector3()).y).toBeCloseTo(targetSpan, 5);
  fit.dispose();
});
