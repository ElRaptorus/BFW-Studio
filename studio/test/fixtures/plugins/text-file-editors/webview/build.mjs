/**
 * Bundles the CodeMirror-based webview scripts into single JS files plus HTML/CSS.
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
  minify: false,
  sourcemap: false,
  loader: { '.ts': 'ts' },
};

await Promise.all([
  build({
    ...sharedOptions,
    entryPoints: [resolve(here, 'src/markdown.ts')],
    outfile: resolve(here, 'dist/markdown.js'),
  }),
  build({
    ...sharedOptions,
    entryPoints: [resolve(here, 'src/json.ts')],
    outfile: resolve(here, 'dist/json.js'),
  }),
]);

copyFileSync(resolve(here, 'src/markdown.html'), resolve(here, 'dist/markdown.html'));
copyFileSync(resolve(here, 'src/markdown.css'), resolve(here, 'dist/markdown.css'));
copyFileSync(resolve(here, 'src/json.html'), resolve(here, 'dist/json.html'));
copyFileSync(resolve(here, 'src/json.css'), resolve(here, 'dist/json.css'));

console.log('[text-file-editors] Webview bundles built successfully.');
