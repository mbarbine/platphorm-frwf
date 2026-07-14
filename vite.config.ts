import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
});
