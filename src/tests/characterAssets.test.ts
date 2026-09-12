// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { Bone, SkinnedMesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { FIGHTER_IDS } from '@frwf/game-protocol';
import { FIGHTERS } from '../game/data/fighters';
import { fitHumanoid } from '../game/presentation/fitHumanoid';
import { relaxPreviewStance } from '../game/presentation/previewStance';
import { crowdPopulation } from '../game/presentation/crowdPopulation';
import type { BodySegmentId } from '../game/physics/bodySchema';
import manifest from '../../public/characters/manifest.json';
import materials from '../../public/characters/materials.json';

const publicFile = (url: string) => readFileSync(resolve(import.meta.dirname, '../../public' + url));

describe('real character assets', () => {
  it('keeps the playable roster, network IDs and exported assets aligned', () => {
    expect(FIGHTERS.map(f => f.id)).toEqual([...FIGHTER_IDS]);
    expect(manifest.fighters.map(f => f.id)).toEqual([...FIGHTER_IDS]);
    expect(new Set(manifest.fighters.map(f => f.sha256)).size).toBe(FIGHTERS.length);
    expect(FIGHTERS.filter(f => f.id === 'dale')).toHaveLength(1);
    expect(FIGHTERS.find(f => f.id === 'gil')?.name).toBe('G.I. JIL');
  });
  it.each(FIGHTERS)('$name loads with usable skin weights, detail bones and a stable preview', async fighter => {
    const asset = manifest.fighters.find(f => f.id === fighter.id);
    if (!asset) throw new Error('Missing asset');
    const bytes = publicFile(asset.url);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
    const scene = (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, '')).scene;
    const fit = fitHumanoid(scene, fighter.id);
    try {
      const bones = new Map<BodySegmentId, Bone>(); let skinned = 0;
      scene.traverse(node => {
        if (node instanceof Bone && !/Thumb|Index|Middle|Ring|Little/.test(node.name)) bones.set(node.name as BodySegmentId, node);
        if (!(node instanceof SkinnedMesh)) return;
        skinned++;
        expect(node.skeleton.bones).toHaveLength(46);
        const weights = node.geometry.getAttribute('skinWeight'); const indices = node.geometry.getAttribute('skinIndex');
        for (let i = 0; i < weights.count; i++) {
          let sum = 0;
          for (let j = 0; j < 4; j++) { sum += weights.getComponent(i,j); expect(indices.getComponent(i,j)).toBeLessThan(node.skeleton.bones.length); }
          expect(sum).toBeCloseTo(1, 4);
        }
        expect(Array.from(node.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);
      });
      expect(skinned).toBeGreaterThan(0);
      expect(bones.size).toBe(16);
      relaxPreviewStance(bones); const posed = [...bones.values()].map(b => [...b.position.toArray(),...b.quaternion.toArray()]);
      relaxPreviewStance(bones); expect([...bones.values()].map(b => [...b.position.toArray(),...b.quaternion.toArray()])).toEqual(posed);
      const skin = publicFile(materials[fighter.id].skinUrl);
      expect(createHash('sha256').update(skin).digest('hex')).toBe(materials[fighter.id].sha256);
    } finally { fit.dispose(); }
  });
});

describe('crowd groups', () => {
  it('is deterministic, bounded and supports fractional or invalid requests', () => {
    expect(crowdPopulation(2000,12)).toHaveLength(960);
    expect(crowdPopulation(3.9,12)).toHaveLength(3);
    expect(crowdPopulation(100,NaN)).toEqual([]);
    expect(crowdPopulation(80,12,7)).toEqual(crowdPopulation(80,12,7));
    expect(crowdPopulation(80,12,7)).not.toEqual(crowdPopulation(80,12,8));
    expect(new Set(crowdPopulation(80,12).map(f => f.variant)).size).toBeGreaterThan(8);
  });
});
