import type { ExecException } from 'child_process';
import { exec, execSync } from 'child_process';

function getRawAndEscapedPathForMacOSAndLinux(result: string): string {
  return result.trim().replace(/^\.\//g, '').replace(/\s/g, '\\ ').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

async function getBuiltStudioPath(): Promise<string> {
  const isWindows = process.platform === 'win32';
  const isLinux = process.platform === 'linux';

  if (isWindows) {
    try {
      const currentDir = await execCommand('CD');
      const result = await execCommand(`where /r "${currentDir.trim()}" "Bifrost Forge World*.exe"`);
      const files = result.split('\n');
      const correctPath = files.find((path) => path.includes('win-unpacked')) as string;

      if (!correctPath) {
        throw new Error('Unable to find the Studio Electron App!');
      }

      return `"${correctPath.trim()}"`;
    } catch (error) {
      console.error(error);
      return process.exit(1);
    }
  } else if (isLinux) {
    try {
      const result = await execCommand('find ./dist/electron/bifrost-forge-world-*.AppImage');
      const rawPath = getRawAndEscapedPathForMacOSAndLinux(result);

      return rawPath;
    } catch (error) {
      console.error(error);
      return process.exit(1);
    }
  }

  try {
    const arch = getArchitecture();
    const macAppFolder = arch === 'arm64' ? 'mac-arm64' : 'mac';
    const result = await execCommand(
      `find ./dist/electron/${macAppFolder}/*.app/Contents/MacOS/Bifrost\\ Forge\\ World*`,
    );
    const rawPath = getRawAndEscapedPathForMacOSAndLinux(result);

    return rawPath;
  } catch (error) {
    console.error(error);
    return process.exit(1);
  }
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
  let arch = process.arch;
  if (process.platform === 'darwin' && arch === 'x64') {
    // When ON macOS we should check if we're running under rosetta and use the arm64 version
    try {
      const output = execSync('sysctl -in sysctl.proc_translated');
      if (output.toString().trim() === '1') {
        arch = 'arm64';
      }
    } catch {
      // Ignore failure
    }
  }
  return arch;
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

  const childProcess = exec(`cross-env TEST_APP_PATH=${pathToBifrost} npm run ${npmRunArgs.join(' ')}`);

  childProcess.stdout?.on('data', (data) => {
    console.log(data);
  });

  childProcess.stderr?.on('data', (data) => {
    console.error(data);
  });

  childProcess.on('exit', (code, signal) => {
    process.exit(code as number);
  });
}

runTests();
