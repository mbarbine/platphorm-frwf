import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
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
    deploymentEnvironment: process.env.VERCEL_ENV ?? mode,
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
  define: { __RINGFALL_RELEASE__: JSON.stringify(releaseIdentity) },
  server: { allowedHosts: ['host.docker.internal'], watch: { ignored: ['**/.vercel/**'] } },
  build: {
    target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 900,
    rolldownOptions: { output: { codeSplitting: {
      includeDependenciesRecursively: false,
      groups: [
        { name: 'rapier-wasm', test: /node_modules[\\/]@dimforge[\\/]rapier3d-compat/, priority: 50 },
        { name: 'react-rapier', test: /node_modules[\\/]@react-three[\\/]rapier/, priority: 40 },
        { name: 'react-three-drei', test: /node_modules[\\/]@react-three[\\/]drei/, priority: 35 },
        { name: 'react-three-fiber', test: /node_modules[\\/]@react-three[\\/]fiber/, priority: 30 },
        { name: 'three-core', test: /node_modules[\\/]three[\\/]/, priority: 20 },
        { name: 'react-runtime', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 10 },
      ],
    } } },
  },
  test: { environment: 'node', include: ['src/tests/**/*.test.ts'] },
  };
});
