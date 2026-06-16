import type { ExecException } from 'child_process';
import { exec } from 'child_process';
import { ipcRenderer, shell } from 'electron';
import log from 'electron-log';

import type { EditorDocument } from '@evil/bifrost_fw_sdk';

import type { Bifrost } from '../Bifrost';
import { IPC_INVOKE_GET_APP_PATH, IPC_INVOKE_OPEN_PATH, IPC_INVOKE_SHOW_ITEM_IN_FOLDER } from '../contracts/IpcEvents';

type ShellCommandResult = {
  success: boolean;
  stdout: string | Buffer;
  stderr: string | Buffer;
  error?: Error;
};

export function initializeElectronCommands(bifrost: Bifrost): void {
  const commands = bifrost.commands;

  bifrost.settings.register({
    'shell.commands.openTerminalInDirectory': {
      type: 'string',
      label: 'Open Terminal in Directory',
      description: 'Shell command to open a terminal in a given directory. Use "$1" as the directory placeholder.',
      default: null,
    },
    'shell.commands.openTerminalInDirectory.macos': {
      type: 'string',
      label: 'Open Terminal in Directory (macOS)',
      description: 'macOS-specific command to open a terminal in a directory.',
      default: 'open -a Terminal "$1"',
    },
    'shell.commands.openTerminalInDirectory.windows': {
      type: 'string',
      label: 'Open Terminal in Directory (Windows)',
      description: 'Windows-specific command to open a terminal in a directory.',
      default: 'start cmd.exe /K cd /D "$1"',
    },
    'shell.commands.openDocumentInTextEditor': {
      type: 'string',
      label: 'Open Document in Text Editor',
      description: 'Shell command to open a file in an external text editor. Use "$1" as the file path placeholder.',
      default: null,
    },
    'shell.commands.openDocumentInTextEditor.macos': {
      type: 'string',
      label: 'Open Document in Text Editor (macOS)',
      description: 'macOS-specific command to open a file in an external text editor.',
      default: '/Applications/Visual\\ Studio\\ Code.app/Contents/Resources/app/bin/code --goto "$1"',
    },
    'shell.commands.openDocumentInTextEditor.windows': {
      type: 'string',
      label: 'Open Document in Text Editor (Windows)',
      description: 'Windows-specific command to open a file in an external text editor.',
      default: 'code --goto "$1"',
    },
    'shell.commands.openDocumentInTextEditorAtLine': {
      type: 'string',
      label: 'Open Document at Line',
      description: 'Shell command to open a file at a specific line. Use "$1" for file and "$2" for line.',
      default: null,
    },
    'shell.commands.openDocumentInTextEditorAtLine.macos': {
      type: 'string',
      label: 'Open Document at Line (macOS)',
      description: 'macOS-specific command to open a file at a specific line.',
      default: '/Applications/Visual\\ Studio\\ Code.app/Contents/Resources/app/bin/code --goto "$1:$2"',
    },
    'shell.commands.openDocumentInTextEditorAtLine.windows': {
      type: 'string',
      label: 'Open Document at Line (Windows)',
      description: 'Windows-specific command to open a file at a specific line.',
      default: 'code --goto "$1:$2"',
    },
    'shell.commands.openDocumentInTextEditorAtLineAndColumn': {
      type: 'string',
      label: 'Open Document at Line and Column',
      description: 'Shell command to open a file at a specific line and column. Use "$1", "$2", "$3".',
      default: null,
    },
    'shell.commands.openDocumentInTextEditorAtLineAndColumn.macos': {
      type: 'string',
      label: 'Open Document at Line and Column (macOS)',
      description: 'macOS-specific command to open a file at a specific line and column.',
      default: '/Applications/Visual\\ Studio\\ Code.app/Contents/Resources/app/bin/code --goto "$1:$2:$3"',
    },
    'shell.commands.openDocumentInTextEditorAtLineAndColumn.windows': {
      type: 'string',
      label: 'Open Document at Line and Column (Windows)',
      description: 'Windows-specific command to open a file at a specific line and column.',
      default: 'code --goto "$1:$2:$3"',
    },
  });

  commands.register('std.shell.getUserSettingOrPlatformSpecificDefault', (basename: string) => {
    const userDefinedSetting = bifrost.settings.get(basename);
    if (userDefinedSetting != null) {
      return userDefinedSetting;
    }

    if (bifrost.env.isMac) {
      return bifrost.settings.get(`${basename}.macos`);
    } else if (bifrost.env.isWindows) {
      return bifrost.settings.get(`${basename}.windows`);
    }

    throw Error('Unexpected environment');
  });

  commands.register('std.shell.openTerminalInDirectory.electron', async (uri: string) => {
    const localPath = (await bifrost.files.isDirectory(uri))
      ? bifrost.files.getLocalFilenameForUri(uri)
      : await bifrost.files.getLocalDirectory(uri);

    const shellCommandTemplate = commands.executeCommand('std.shell.getUserSettingOrPlatformSpecificDefault', [
      'shell.commands.openTerminalInDirectory',
    ]);
    const shellCommand = shellCommandTemplate.replace('$1', localPath);

    commands.executeCommand('std.shell.executeShellCommand', [shellCommand]);
  });

  commands.register('std.shell.openUrlInBrowser.electron', (httpUrl: string) => {
    shell.openExternal(httpUrl);
  });

  commands.register('std.shell.openUrl.electron', (anyUrl: string) => {
    shell.openExternal(anyUrl);
  });

  commands.register(
    'std.shell.showDocumentInFileManager.electron',
    async (editorDocumentOrUri: EditorDocument | string) => {
      const uri = typeof editorDocumentOrUri === 'string' ? editorDocumentOrUri : editorDocumentOrUri.uri;
      const path = bifrost.files.getLocalFilenameForUri(uri);

      if (await bifrost.files.isDirectory(uri)) {
        const errorMessage = await ipcRenderer.invoke(IPC_INVOKE_OPEN_PATH, path);
        if (errorMessage != '') {
          throw new Error(errorMessage);
        }
      } else {
        await ipcRenderer.invoke(IPC_INVOKE_SHOW_ITEM_IN_FOLDER, path);
      }
    },
  );

  commands.register(
    'std.shell.openDocumentInTextEditor.electron',
    async (editorDocumentOrUri: EditorDocument | string, lineNo?: number, column?: number) => {
      const uri = typeof editorDocumentOrUri === 'string' ? editorDocumentOrUri : editorDocumentOrUri.uri;
      const localPath = bifrost.files.getLocalFilenameForUri(uri);

      let setting: string;
      if (lineNo == null && column == null) {
        setting = 'shell.commands.openDocumentInTextEditor';
      } else if (lineNo != null && column == null) {
        setting = 'shell.commands.openDocumentInTextEditorAtLine';
      } else {
        setting = 'shell.commands.openDocumentInTextEditorAtLineAndColumn';
      }

      const shellCommandTemplate = commands.executeCommand('std.shell.getUserSettingOrPlatformSpecificDefault', [
        setting,
      ]);

      const shellCommand = shellCommandTemplate
        .replace('$1', localPath)
        .replace('$2', lineNo?.toString() ?? '')
        .replace('$3', column?.toString() ?? '');

      const shellCommandResult = await commands.executeCommand('std.shell.executeShellCommand', [shellCommand]);

      if (shellCommandResult.exitCode !== 0) {
        // TODO: show notification
        console.error(shellCommandResult.error);
      }
    },
  );

  commands.register(
    'std.shell.showLogDirectoryInFileManager.electron',
    () => {
      const logPath = log.transports.file?.getFile().path ?? '';
      const logUri = bifrost.files.getUriForFilename(logPath);
      bifrost.commands.executeCommand('std.shell.showDocumentInFileManager', [logUri]);
    },
    { enabledWhen: () => log.transports.file?.getFile().path != null },
  );

  commands.register('std.shell.showApplicationPath.electron', async () => {
    const content = await ipcRenderer.invoke(IPC_INVOKE_GET_APP_PATH);

    bifrost.commands.executeCommand('std.dialog.openCopyAndPaste', ['Application Path', content]);
  });

  commands.register<ShellCommandResult>(
    'std.shell.executeShellCommand',
    async (shellCommand: string): Promise<ShellCommandResult> => {
      try {
        const result = await new Promise<ShellCommandResult>((resolve, reject) => {
          exec(shellCommand, (error: ExecException | null, stdout: string | Buffer, stderr: string | Buffer): void => {
            if (error) {
              const result: ShellCommandResult = {
                success: false,
                stdout: stdout,
                stderr: stderr,
                error: error,
              };
              console.warn(`executeShellCommand \`${shellCommand}\` failed!`, stdout);
              console.warn('stdout from executeShellCommand', stdout);
              console.warn('stderr from executeShellCommand', stderr);
              resolve(result);
            } else {
              const result: ShellCommandResult = {
                success: true,
                stdout: stdout,
                stderr: stderr,
              };
              resolve(result);
            }
          });
        });

        return result;
      } catch (error) {
        return {
          success: false,
          stdout: '',
          stderr: '',
          error: error,
        };
      }
    },
  );
}
