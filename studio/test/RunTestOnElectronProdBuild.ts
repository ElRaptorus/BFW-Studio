import type { ExecException } from 'child_process';
import { exec, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

function quoteForShell(filePath: string): string {
  return `"${filePath.replace(/"/g, '\\"')}"`;
}

async function getBuiltStudioPath(): Promise<string> {
  const configuredApplicationPath = process.env.TEST_APP_PATH;
  if (configuredApplicationPath) {
    if (!fs.existsSync(configuredApplicationPath)) {
      throw new Error(`TEST_APP_PATH does not exist: ${configuredApplicationPath}`);
    }
    return configuredApplicationPath;
  }

  const isWindows = process.platform === 'win32';
  const isLinux = process.platform === 'linux';

  if (isWindows) {
    try {
      const currentDir = await execCommand('CD');
      const result = await execCommand(`where /r "${currentDir.trim()}" "Bifrost Forge World*.exe"`);
      const files = result.split('\n');
      const correctPath = files.find((filePath) => filePath.includes('win-unpacked'));

      if (!correctPath) {
        throw new Error('Unable to find the Studio Electron App!');
      }

      return correctPath.trim();
    } catch (error) {
      console.error(error);
      return process.exit(1);
    }
  } else if (isLinux) {
    try {
      return findLinuxUnpackedExecutable();
    } catch (error) {
      console.error(error);
      return process.exit(1);
    }
  }

  try {
    const architecture = getArchitecture();
    const macAppFolder = architecture === 'arm64' ? 'mac-arm64' : 'mac';
    const result = await execCommand(
      `find ./dist/electron/${macAppFolder}/*.app/Contents/MacOS/Bifrost\\ Forge\\ World*`,
    );

    return result.trim().replace(/^\.\//g, '');
  } catch (error) {
    console.error(error);
    return process.exit(1);
  }
}

function findLinuxUnpackedExecutable(): string {
  const unpackedDirectory = path.join('dist', 'electron', 'linux-unpacked');
  if (!fs.existsSync(unpackedDirectory)) {
    throw new Error(`Linux unpacked app directory not found: ${unpackedDirectory}`);
  }

  const directoryEntries = fs.readdirSync(unpackedDirectory, { withFileTypes: true });
  const executableCandidates = directoryEntries
    .filter((directoryEntry) => directoryEntry.isFile())
    .map((directoryEntry) => directoryEntry.name)
    .filter((fileName) => fileName.startsWith('bfw-studio-') && !fileName.endsWith('-launcher'))
    .sort();

  if (executableCandidates.length === 0) {
    throw new Error(
      `Unable to find the Studio Electron binary in ${unpackedDirectory}. Expected bfw-studio-<version>, not the AppImage or the *-launcher script.`,
    );
  }

  return path.join(unpackedDirectory, executableCandidates[0]);
}

async function execCommand(command: string): Promise<string> {
  return new Promise((resolve, reject): void => {
    exec(command, (error: ExecException | null, stdout: string, stderr: string) => {
      if (error || stderr) {
        reject(error ?? stderr);
      }
      return resolve(stdout);
    });
  });
}

function getArchitecture() {
  let architecture = process.arch;
  if (process.platform === 'darwin' && architecture === 'x64') {
    // When ON macOS we should check if we're running under rosetta and use the arm64 version
    try {
      const output = execSync('sysctl -in sysctl.proc_translated');
      if (output.toString().trim() === '1') {
        architecture = 'arm64';
      }
    } catch {
      // Ignore failure
    }
  }
  return architecture;
}

async function runTests(): Promise<void> {
  const pathToBifrost = await getBuiltStudioPath();
  const npmRunArgs = process.argv.slice(2);
  if (npmRunArgs.length === 0) {
    console.error('Please provide an npm test script to run:');
    console.error('  npm run test-prod:electron test:integration:bpmn-editor');
    console.error('');
    process.exit(2);
  }

  console.log(`Running production Electron tests against: ${pathToBifrost}`);

  const childProcess = exec(`cross-env TEST_APP_PATH=${quoteForShell(pathToBifrost)} npm run ${npmRunArgs.join(' ')}`);

  childProcess.stdout?.on('data', (data) => {
    console.log(data);
  });

  childProcess.stderr?.on('data', (data) => {
    console.error(data);
  });

  childProcess.on('exit', (code, _signal) => {
    process.exit(code as number);
  });
}

runTests();
