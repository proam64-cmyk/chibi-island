import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`          → normal web build in dist/ (assets as separate, fingerprinted files).
// `npm run build:preview`  → one self-contained HTML file (assets inlined) for sharing a test build.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'preview' ? [viteSingleFile()] : [],
  build: {
    outDir: mode === 'preview' ? 'dist-preview' : 'dist',
    assetsInlineLimit: mode === 'preview' ? 100_000_000 : 4096,
    chunkSizeWarningLimit: 2000,
  },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
}));
