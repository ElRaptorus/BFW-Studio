/**
 * Compiles the TypeScript fixture plugins that ship source-only (`dist/` is gitignored).
 * The plugin host loads `package.json` `"main"` — typically `dist/index.js` — not `src/`.
 *
 * Usage: `npm run build:plugin-fixtures` from `studio/`.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(here, '../../..');
const tsc = resolve(studioRoot, 'node_modules/.bin/tsc');

const typescriptFixtures = ['text-file-editors', 'webview-showcase'];

/**
 * @param {string} command
 * @param {string[]} args
 * @param {string} cwd
 */
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: false });
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${command} ${args.join(' ')} (cwd: ${cwd})`);
  }
}

if (!existsSync(tsc)) {
  throw new Error(`TypeScript compiler not found at ${tsc}. Run npm ci in studio/ first.`);
}

for (const pluginName of typescriptFixtures) {
  const pluginDir = resolve(here, pluginName);
  const webviewDir = resolve(pluginDir, 'webview');

  console.log(`[build-ts-fixtures] ${pluginName}: backend (tsc)`);
  run('npm', ['ci', '--ignore-scripts'], pluginDir);
  run(tsc, ['--project', 'tsconfig.json'], pluginDir);

  console.log(`[build-ts-fixtures] ${pluginName}: webview (esbuild)`);
  run('npm', ['ci'], webviewDir);
  run('node', ['build.mjs'], webviewDir);
}

console.log('[build-ts-fixtures] Done.');
