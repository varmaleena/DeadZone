import { defineConfig } from 'vite';
import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = __dirname;

export default defineConfig({
  root,
  envDir: root,
  publicDir: resolve(root, 'public'),
  build: {
    outDir: resolve(root, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        panel: resolve(root, 'panel.html'),
        background: resolve(root, 'src/background.ts'),
      },
      output: {
        // The service worker must have a fixed file name referenced by manifest.json.
        entryFileNames: (chunk) => (chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
  plugins: [
    {
      name: 'deadzone-manifest',
      closeBundle() {
        mkdirSync(resolve(root, 'dist'), { recursive: true });
        copyFileSync(resolve(root, 'manifest.json'), resolve(root, 'dist/manifest.json'));
      },
    },
  ],
});
