import * as assert from 'node:assert';
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, it } from 'vitest';

const GENERATOR_DIR = path.resolve(__dirname, '../../../../tools/create-evil-plugin');
const GENERATOR_SCRIPT = path.join(GENERATOR_DIR, 'src', 'generator.js');
const SDK_DIR = path.resolve(__dirname, '../../../../studio-sdk');

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'evil-plugin-test-'));
}

function removeDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * Invoke the generator programmatically via a child Node process.
 * Avoids import() complexities with ESM modules in the test runner.
 */
function runGenerator(
  outputDir: string,
  options: { pluginName: string; displayName: string; description: string; includeWebview: boolean },
): void {
  const fullOptions = { ...options, outputDir };
  const script = `
    import { generate } from '${GENERATOR_SCRIPT}';
    await generate(${JSON.stringify(fullOptions)});
  `;
  execSync(`node --input-type=module -e "${script.replace(/"/g, '\\"')}"`, {
    cwd: outputDir,
    stdio: 'pipe',
    timeout: 30_000,
  });
}

/**
 * The template uses `@evil/bifrost_fw_sdk: "^1.0.0"` for distribution.
 * Since the SDK isn't published yet, patch the generated package.json
 * to use a `file:` reference to the local SDK for build tests.
 */
function patchSdkDependency(pluginDir: string): void {
  const packageJsonPath = path.join(pluginDir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  if (packageJson.devDependencies?.['@evil/bifrost_fw_sdk']) {
    packageJson.devDependencies['@evil/bifrost_fw_sdk'] = `file:${SDK_DIR}`;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8');
  }
}

describe('create-evil-plugin scaffold generator', () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) {
      removeDir(tempDir);
    }
  });

  describe('minimal template', () => {
    it('generates the expected files', () => {
      tempDir = createTempDir();
      runGenerator(tempDir, {
        pluginName: 'my-test-plugin',
        displayName: 'My Test Plugin',
        description: 'Integration test plugin',
        includeWebview: false,
      });

      const pluginDir = path.join(tempDir, 'my-test-plugin');
      assert.ok(fs.existsSync(path.join(pluginDir, 'package.json')));
      assert.ok(fs.existsSync(path.join(pluginDir, 'tsconfig.json')));
      assert.ok(fs.existsSync(path.join(pluginDir, 'src', 'index.ts')));
      assert.ok(!fs.existsSync(path.join(pluginDir, 'webview')));
    });

    it('generates valid package.json with bifrostStudio manifest', () => {
      tempDir = createTempDir();
      runGenerator(tempDir, {
        pluginName: 'manifest-check',
        displayName: 'Manifest Check',
        description: 'Testing manifest',
        includeWebview: false,
      });

      const pkg = JSON.parse(fs.readFileSync(path.join(tempDir, 'manifest-check', 'package.json'), 'utf-8'));
      assert.strictEqual(pkg.name, 'manifest-check');
      assert.strictEqual(pkg.displayName, 'Manifest Check');
      assert.ok(pkg.bifrostStudio);
      assert.strictEqual(pkg.bifrostStudio.apiVersion, '1.0.0');
      assert.ok(Array.isArray(pkg.bifrostStudio.activationEvents));
      assert.ok(pkg.bifrostStudio.contributes.commands.length > 0);
    });

    it('uses semver SDK dependency for distribution', () => {
      tempDir = createTempDir();
      runGenerator(tempDir, {
        pluginName: 'sdk-version-check',
        displayName: 'SDK Version Check',
        description: '',
        includeWebview: false,
      });

      const pkg = JSON.parse(fs.readFileSync(path.join(tempDir, 'sdk-version-check', 'package.json'), 'utf-8'));
      assert.strictEqual(pkg.devDependencies['@evil/bifrost_fw_sdk'], '^1.0.0');
    });

    it('generates a buildable plugin', () => {
      tempDir = createTempDir();
      runGenerator(tempDir, {
        pluginName: 'buildable-plugin',
        displayName: 'Buildable Plugin',
        description: 'Build test',
        includeWebview: false,
      });

      const pluginDir = path.join(tempDir, 'buildable-plugin');
      patchSdkDependency(pluginDir);
      execSync('npm install', { cwd: pluginDir, stdio: 'pipe', timeout: 60_000 });
      execSync('npm run build', { cwd: pluginDir, stdio: 'pipe', timeout: 30_000 });

      assert.ok(fs.existsSync(path.join(pluginDir, 'dist', 'index.js')));
      const distContent = fs.readFileSync(path.join(pluginDir, 'dist', 'index.js'), 'utf-8');
      assert.ok(distContent.includes('activate'));
    });

    it('generated index.ts references SDK types', () => {
      tempDir = createTempDir();
      runGenerator(tempDir, {
        pluginName: 'type-check',
        displayName: 'Type Check',
        description: '',
        includeWebview: false,
      });

      const src = fs.readFileSync(path.join(tempDir, 'type-check', 'src', 'index.ts'), 'utf-8');
      assert.ok(src.includes('StudioPluginApi'));
      assert.ok(src.includes('@evil/bifrost_fw_sdk'));
      assert.ok(src.includes('activate'));
      assert.ok(src.includes('deactivate'));
    });
  });

  describe('webview template', () => {
    it('generates webview files in addition to base files', () => {
      tempDir = createTempDir();
      runGenerator(tempDir, {
        pluginName: 'webview-plugin',
        displayName: 'Webview Plugin',
        description: 'Webview test',
        includeWebview: true,
      });

      const pluginDir = path.join(tempDir, 'webview-plugin');
      assert.ok(fs.existsSync(path.join(pluginDir, 'package.json')));
      assert.ok(fs.existsSync(path.join(pluginDir, 'src', 'index.ts')));
      assert.ok(fs.existsSync(path.join(pluginDir, 'webview', 'package.json')));
      assert.ok(fs.existsSync(path.join(pluginDir, 'webview', 'build.mjs')));
      assert.ok(fs.existsSync(path.join(pluginDir, 'webview', 'tsconfig.json')));
      assert.ok(fs.existsSync(path.join(pluginDir, 'webview', 'src', 'index.html')));
      assert.ok(fs.existsSync(path.join(pluginDir, 'webview', 'src', 'main.tsx')));
      assert.ok(fs.existsSync(path.join(pluginDir, 'webview', 'src', 'App.tsx')));
      assert.ok(fs.existsSync(path.join(pluginDir, 'webview', 'src', 'styles.css')));
    });

    it('webview template registers a pane in activate()', () => {
      tempDir = createTempDir();
      runGenerator(tempDir, {
        pluginName: 'pane-check',
        displayName: 'Pane Check',
        description: '',
        includeWebview: true,
      });

      const src = fs.readFileSync(path.join(tempDir, 'pane-check', 'src', 'index.ts'), 'utf-8');
      assert.ok(src.includes('registerWebviewPane'));
      assert.ok(src.includes('webview/dist/index.html'));
    });

    it('generates a buildable webview plugin', () => {
      tempDir = createTempDir();
      runGenerator(tempDir, {
        pluginName: 'buildable-webview',
        displayName: 'Buildable Webview',
        description: 'Full build test',
        includeWebview: true,
      });

      const pluginDir = path.join(tempDir, 'buildable-webview');
      patchSdkDependency(pluginDir);
      execSync('npm install', { cwd: pluginDir, stdio: 'pipe', timeout: 60_000 });
      execSync('npm install', { cwd: path.join(pluginDir, 'webview'), stdio: 'pipe', timeout: 60_000 });
      execSync('npm run build', { cwd: pluginDir, stdio: 'pipe', timeout: 30_000 });

      assert.ok(fs.existsSync(path.join(pluginDir, 'dist', 'index.js')));
      assert.ok(fs.existsSync(path.join(pluginDir, 'webview', 'dist', 'main.js')));
      assert.ok(fs.existsSync(path.join(pluginDir, 'webview', 'dist', 'index.html')));
    });
  });

  it('refuses to overwrite an existing directory', () => {
    tempDir = createTempDir();
    runGenerator(tempDir, {
      pluginName: 'collision-test',
      displayName: 'Collision',
      description: '',
      includeWebview: false,
    });

    assert.throws(
      () =>
        runGenerator(tempDir, {
          pluginName: 'collision-test',
          displayName: 'Collision',
          description: '',
          includeWebview: false,
        }),
      /already exists/,
    );
  });

  it('interpolates template variables correctly', () => {
    tempDir = createTempDir();
    runGenerator(tempDir, {
      pluginName: 'interpolation-test',
      displayName: 'My Cool Plugin',
      description: 'A plugin that does cool things',
      includeWebview: false,
    });

    const pluginDir = path.join(tempDir, 'interpolation-test');
    const pkg = JSON.parse(fs.readFileSync(path.join(pluginDir, 'package.json'), 'utf-8'));
    assert.strictEqual(pkg.name, 'interpolation-test');
    assert.strictEqual(pkg.displayName, 'My Cool Plugin');
    assert.strictEqual(pkg.description, 'A plugin that does cool things');

    const src = fs.readFileSync(path.join(pluginDir, 'src', 'index.ts'), 'utf-8');
    assert.ok(src.includes('My Cool Plugin'));
    assert.ok(!src.includes('{{'));
  });
});
