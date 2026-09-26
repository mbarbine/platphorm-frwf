// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import manifest from '../../public/characters/manifest.json';
import { bindFingerPoses } from '../game/presentation/handPose';

describe('anatomical fists on the shipping characters', () => {
  it.each(manifest.fighters)('$id folds fingers into the palm instead of across the knuckles', async asset => {
    const bytes = readFileSync(resolve(import.meta.dirname, `../../public${asset.url}`));
    const scene = (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, '')).scene;
    scene.updateMatrixWorld(true);
    const point = (name: string) => {
      const bone = scene.getObjectByName(name);
      if (!bone) throw new Error(`Missing ${name}`);
      return bone.getWorldPosition(new Vector3());
    };
    const open = Object.fromEntries(['left', 'right'].map(side => {
      const palm = point(`${side}Index1`).sub(point(`${side}Little1`)).cross(point(`${side}Middle1`).sub(point(`${side}Hand`))).normalize().multiplyScalar(side === 'left' ? 1 : -1);
      return [side, { palm, hand: point(`${side}Hand`), thumb: point(`${side}Thumb3`), fingers: ['Index', 'Middle', 'Ring', 'Little'].map(finger => point(`${side}${finger}3`)) }];
    }));
    for (const finger of bindFingerPoses(scene)) finger.bone.quaternion.copy(finger.rest).multiply(new Quaternion().setFromAxisAngle(finger.curlAxis, finger.closedAngle));
    scene.updateMatrixWorld(true);
    for (const side of ['left', 'right']) {
      const before = open[side];
      if (!before) throw new Error(`Missing open ${side} hand`);
      for (const [i, finger] of ['Index', 'Middle', 'Ring', 'Little'].entries()) {
        const openFinger = before.fingers[i];
        if (!openFinger) throw new Error(`Missing open ${side} ${finger}`);
        const closed = point(`${side}${finger}3`);
        const firstLink = point(`${side}${finger}2`).sub(point(`${side}${finger}1`));
        expect(firstLink.clone().normalize().dot(before.palm), `${side} ${finger} must bend inward`).toBeGreaterThan(.45);
        expect(closed.distanceTo(before.hand)).toBeLessThan(openFinger.distanceTo(before.hand) * .85);
      }
      expect(point(`${side}Thumb3`).distanceTo(before.hand)).toBeLessThan(before.thumb.distanceTo(before.hand) * .65);
    }
  });
});
