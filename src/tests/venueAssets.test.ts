import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import manifest from '../../public/venue/completion/manifest.json';

describe('venue completion assets', () => {
  for (const [kind, asset] of Object.entries(manifest.assets)) {
    it(`${kind} has intact geometry, local bounded textures and a stable collision envelope`, () => {
      const bytes = readFileSync(resolve('public', asset.url.slice(1)));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
      expect(bytes.readUInt32LE(0)).toBe(0x46546c67);
      expect(bytes.readUInt32LE(8)).toBe(bytes.length);
      const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString()) as {
        buffers: { byteLength: number }[]; bufferViews: { byteOffset: number; byteLength: number }[];
        images: { uri: string; bufferView?: number }[]; skins?: unknown[]; animations?: unknown[];
      };
      expect(json.skins ?? []).toHaveLength(0);
      expect(json.animations ?? []).toHaveLength(0);
      for (const view of json.bufferViews) expect(view.byteOffset + view.byteLength).toBeLessThanOrEqual(json.buffers[0]?.byteLength ?? 0);
      for (const image of json.images) {
        expect(image.uri).toMatch(/^textures\/[a-f0-9]{20}\.png$/);
        expect(image.bufferView).toBeUndefined();
        const png = readFileSync(resolve('public/venue/completion', image.uri));
        expect(png.readUInt32BE(16)).toBeLessThanOrEqual(512);
        expect(png.readUInt32BE(20)).toBeLessThanOrEqual(512);
      }
      expect(asset.colliders.length).toBeGreaterThan(0);
      for (const collider of asset.colliders) for (let axis = 0; axis < 3; axis++) {
        const center = collider.center[axis] ?? NaN; const half = collider.halfExtents[axis] ?? NaN;
        expect(half).toBeGreaterThan(0);
        expect(center - half).toBeGreaterThanOrEqual((asset.bounds[0]?.[axis] ?? NaN) - .016);
        expect(center + half).toBeLessThanOrEqual((asset.bounds[1]?.[axis] ?? NaN) + .016);
      }
    });
  }
});
