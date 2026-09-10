// @vitest-environment node
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import type { SkinnedMesh } from 'three';
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
    const source = gltf.scene.getObjectByName(asset.id) as SkinnedMesh;
    const originalY = source.geometry.getAttribute('position').getY(0);
    const instance = clone(gltf.scene);
    const fit = fitHumanoid(instance, asset.id as FighterId);
    const schema = buildBodySchema(fighterById(asset.id as FighterId));
    const targetSpan = (schema.find(s => s.id === 'head')?.localPosition[1] ?? 0) - (schema.find(s => s.id === 'leftFoot')?.localPosition[1] ?? 0);
    expect((instance.getObjectByName('head')?.position.y ?? 0) - (instance.getObjectByName('leftFoot')?.position.y ?? 0)).toBeCloseTo(targetSpan, 4);
    expect(gltf.scene.getObjectByName('head')?.position.y).toBe(sourceHead);
    expect(source.geometry.getAttribute('position').getY(0)).toBe(originalY);
    const fitted = instance.getObjectByName(asset.id) as SkinnedMesh;
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
