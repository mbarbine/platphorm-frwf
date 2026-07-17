import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RELEASE_MANIFEST, releaseManifestCounts } from './src/game/release/releaseManifest';

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
const localGitSha = (): string => {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); }
  catch { return 'unknown'; }
};

export default defineConfig(({ mode }) => {
  const gitSha = process.env.VERCEL_GIT_COMMIT_SHA ?? localGitSha();
  const releaseIdentity = {
    applicationVersion: packageJson.version,
    gitSha,
    shortGitSha: gitSha === 'unknown' ? gitSha : gitSha.slice(0, 8),
    buildTimestamp: new Date().toISOString(),
    fighterManifestVersion: RELEASE_MANIFEST.fighterVersion,
    moveManifestVersion: RELEASE_MANIFEST.moveVersion,
    arenaManifestVersion: RELEASE_MANIFEST.arenaVersion,
    assetManifestVersion: RELEASE_MANIFEST.assetVersion,
    presentationRigVersion: RELEASE_MANIFEST.presentationRigVersion,
    // Vite's production build mode is not evidence of a production deploy.
    // Keep local/CI release diagnostics explicit so preview output can never
    // be mistaken for the live Vercel environment.
    deploymentEnvironment: process.env.VERCEL_ENV ?? (process.env.CI ? 'ci' : mode === 'production' ? 'local-production-build' : mode),
    fighterCount: releaseManifestCounts.fighters,
    moveCount: releaseManifestCounts.moves,
    criticalAssetCount: releaseManifestCounts.criticalAssets,
  };
  const releaseAssetsPlugin = {
    name: 'ringfall-release-identity',
    async closeBundle() {
      const mergeHealth = async (path: string) => {
        const health = JSON.parse(await readFile(path, 'utf8')) as { data: Record<string, unknown> };
        health.data.version = releaseIdentity.applicationVersion;
        health.data.environment = releaseIdentity.deploymentEnvironment;
        health.data.releaseIdentity = releaseIdentity;
        await writeFile(path, `${JSON.stringify(health)}\n`);
      };
      await mkdir('dist/api', { recursive: true });
      await mergeHealth('dist/api/health');
      await mergeHealth('dist/api/v1/health');
      const payload = `${JSON.stringify({ ok: true, data: releaseIdentity })}\n`;
      await writeFile('dist/release.json', payload);
      await writeFile('dist/api/release', payload);
    },
  };
  return {
  plugins: [react(), releaseAssetsPlugin],
  // Three's package root is a single pre-bundled module. Pointing the exact
  // root import at its source graph lets Rolldown keep renderer, animation,
  // geometry, and material code in independently cached lazy chunks while
  // preserving normal `three/addons/*` exports.
  resolve: {
    alias: [
      // The shared protocol package is compiled as CommonJS for the Colyseus
      // server. Vite must consume its ESM TypeScript source or the browser sees
      // a package with no named exports and crashes before React can mount.
      { find: '@frwf/game-protocol', replacement: fileURLToPath(new URL('./packages/game-protocol/src/index.ts', import.meta.url)) },
      { find: /^three$/, replacement: fileURLToPath(new URL('./node_modules/three/src/Three.js', import.meta.url)) },
    ],
  },
  define: { __RINGFALL_RELEASE__: JSON.stringify(releaseIdentity) },
  server: { allowedHosts: ['host.docker.internal'], watch: { ignored: ['**/.vercel/**'] } },
  build: {
    target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 3000,
    rolldownOptions: { output: { codeSplitting: {
      includeDependenciesRecursively: false,
      groups: [
        { name: 'rapier-wasm', test: /node_modules[\\/]@dimforge[\\/]rapier3d-compat/, priority: 50 },
        { name: 'react-rapier', test: /node_modules[\\/]@react-three[\\/]rapier/, priority: 40 },
        { name: 'react-three-drei', test: /node_modules[\\/]@react-three[\\/]drei/, priority: 35 },
        { name: 'react-three-fiber', test: /node_modules[\\/]@react-three[\\/]fiber/, priority: 30 },
        // Keep the public barrel modules out of the implementation chunks.
        // Three.Core re-exports geometry/material/animation symbols; placing
        // that barrel beside its primitives creates cross-chunk TDZ cycles.
        { name: 'three-facade', test: /node_modules[\\/]three[\\/]src[\\/]Three(?:\.Core)?\.js$/, priority: 29 },
        // Three's renderer/material/geometry/object layers are a strongly
        // connected module graph and must initialize together. Animation has
        // a one-way dependency on that runtime and can be cached separately;
        // its two core loaders travel with it to keep the graph acyclic.
        { name: 'three-animation', test: /node_modules[\\/]three[\\/]src[\\/](?:animation[\\/]|loaders[\\/](?:AnimationLoader|ObjectLoader)\.js$)/, priority: 26 },
        { name: 'three-core', test: /node_modules[\\/]three[\\/]/, priority: 20 },
        { name: 'react-runtime', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 10 },
      ],
    } } },
  },
  test: { environment: 'node', include: ['src/tests/**/*.test.ts'] },
  };
});
