import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { watch: { ignored: ['**/.vercel/**'] } },
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 1300 },
  test: { environment: 'node', include: ['src/tests/**/*.test.ts'] },
});
