import { readFileSync, mkdirSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = resolve(__dirname, '..', 'templates');

/**
 * Replace template placeholders in a string.
 *
 * @param {string} content
 * @param {Record<string, string>} vars
 * @returns {string}
 */
function interpolate(content, vars) {
  let result = content;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

/**
 * Read a template file and interpolate variables.
 *
 * @param {string} relativePath - Path relative to templates dir (e.g. "base/package.json")
 * @param {Record<string, string>} vars
 * @returns {string}
 */
function readTemplate(relativePath, vars) {
  const fullPath = join(TEMPLATES_DIR, relativePath);
  const content = readFileSync(fullPath, 'utf-8');
  return interpolate(content, vars);
}

/**
 * Write a file, creating parent directories as needed.
 *
 * @param {string} filePath
 * @param {string} content
 */
function writeFile(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf-8');
}

/**
 * Generate a plugin project from templates.
 *
 * @param {{ pluginName: string, displayName: string, description: string, includeWebview: boolean, outputDir: string }} answers
 */
export async function generate(answers) {
  const { pluginName, displayName, description, includeWebview, outputDir } = answers;
  const outDir = resolve(outputDir, pluginName);

  if (existsSync(outDir)) {
    throw new Error(`Directory "${pluginName}" already exists.`);
  }

  const vars = { pluginName, displayName, description };

  // Base files
  writeFile(join(outDir, 'package.json'), readTemplate('base/package.json.tmpl', vars));
  writeFile(join(outDir, 'tsconfig.json'), readTemplate('base/tsconfig.json.tmpl', vars));
  writeFile(join(outDir, 'src', 'index.ts'), readTemplate('base/src/index.ts.tmpl', vars));

  // Webview additions
  if (includeWebview) {
    writeFile(join(outDir, 'webview', 'package.json'), readTemplate('webview/webview/package.json.tmpl', vars));
    writeFile(join(outDir, 'webview', 'build.mjs'), readTemplate('webview/webview/build.mjs.tmpl', vars));
    writeFile(join(outDir, 'webview', 'tsconfig.json'), readTemplate('webview/webview/tsconfig.json.tmpl', vars));
    writeFile(join(outDir, 'webview', 'src', 'index.html'), readTemplate('webview/webview/src/index.html.tmpl', vars));
    writeFile(join(outDir, 'webview', 'src', 'main.tsx'), readTemplate('webview/webview/src/main.tsx.tmpl', vars));
    writeFile(join(outDir, 'webview', 'src', 'App.tsx'), readTemplate('webview/webview/src/App.tsx.tmpl', vars));
    writeFile(join(outDir, 'webview', 'src', 'styles.css'), readTemplate('webview/webview/src/styles.css.tmpl', vars));

    // Overwrite base index.ts with webview-enabled version
    writeFile(join(outDir, 'src', 'index.ts'), readTemplate('webview/src/index.ts.tmpl', vars));

    // Overwrite package.json with webview build scripts
    writeFile(join(outDir, 'package.json'), readTemplate('webview/package.json.tmpl', vars));
  }

  console.log(`\nCreated plugin "${displayName}" in ${outDir}/\n`);
  console.log('Next steps:');
  if (includeWebview) {
    console.log(`  cd ${outDir} && npm install && cd webview && npm install && cd ..`);
  } else {
    console.log(`  cd ${outDir} && npm install`);
  }
  console.log('  npm run build');
  console.log('  # Restart the Studio to load the new plugin');
}
