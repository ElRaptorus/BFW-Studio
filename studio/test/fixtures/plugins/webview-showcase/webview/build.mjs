/**
 * Bundles the webview React apps into single JS files plus CSS.
 * Uses esbuild for fast, zero-config bundling.
 *
 * Run: node webview/build.mjs
 */
import { build } from 'esbuild';
import { copyFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const sharedOptions = {
  bundle: true,
  format: 'iife',
  target: 'es2020',
  jsx: 'automatic',
  minify: false,
  sourcemap: false,
  loader: { '.tsx': 'tsx', '.ts': 'ts', '.css': 'css' },
};

await Promise.all([
  build({
    ...sharedOptions,
    entryPoints: [resolve(here, 'src/main.tsx')],
    outfile: resolve(here, 'dist/main.js'),
  }),
  build({
    ...sharedOptions,
    entryPoints: [resolve(here, 'src/sidebar-main.tsx')],
    outfile: resolve(here, 'dist/sidebar.js'),
  }),
]);

copyFileSync(resolve(here, 'src/index.html'), resolve(here, 'dist/index.html'));
copyFileSync(resolve(here, 'src/styles.css'), resolve(here, 'dist/styles.css'));
copyFileSync(resolve(here, 'src/sidebar.html'), resolve(here, 'dist/sidebar.html'));
copyFileSync(resolve(here, 'src/sidebar.css'), resolve(here, 'dist/sidebar.css'));

console.log('[webview-showcase] Webview bundles built successfully.');
