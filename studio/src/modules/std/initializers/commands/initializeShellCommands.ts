import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';

export function initializeShellCommands(bifrost: Bifrost): void {
  const commands = bifrost.commands;

  commands.register('std.shell.openUrlInBrowser', (httpUrl: string) => {
    if (bifrost.env.isElectron) {
      if (commands.isRegistered('std.shell.openUrlInBrowser.electron')) {
        commands.executeCommand('std.shell.openUrlInBrowser.electron', [httpUrl]);
      }
    } else {
      window.open(httpUrl);
    }
  });

  commands.register('std.shell.openUrl', (anyUrl: string) => {
    if (bifrost.env.isElectron) {
      if (commands.isRegistered('std.shell.openUrl.electron')) {
        commands.executeCommand('std.shell.openUrl.electron', [anyUrl]);
      }
    } else {
      window.open(anyUrl);
    }
  });

  commands.register(
    'std.shell.openTerminalInDirectory',
    (directoryUri: string) => {
      if (commands.isRegistered('std.shell.openTerminalInDirectory.electron')) {
        commands.executeCommand('std.shell.openTerminalInDirectory.electron', [directoryUri]);
      }
    },
    { enabledWhen: () => bifrost.env.isElectron },
  );

  commands.register(
    'std.shell.openDocumentInTextEditor',
    (editorDocumentOrUri: EditorDocument | string, lineNo?: number, column?: number) => {
      if (commands.isRegistered('std.shell.openDocumentInTextEditor.electron')) {
        commands.executeCommand('std.shell.openDocumentInTextEditor.electron', [editorDocumentOrUri, lineNo, column]);
      }
    },
    {
      enabledWhen: (editorDocumentOrUri: EditorDocument | string) => {
        const uri = typeof editorDocumentOrUri === 'string' ? editorDocumentOrUri : editorDocumentOrUri.uri;
        return editorDocumentOrUri != null && bifrost.env.isElectron && bifrost.files.isLocalFilename(uri);
      },
    },
  );

  commands.register(
    'std.shell.showDocumentInFileManager',
    (editorDocumentOrUri: EditorDocument | string) => {
      if (commands.isRegistered('std.shell.showDocumentInFileManager.electron')) {
        return commands.executeCommand('std.shell.showDocumentInFileManager.electron', [editorDocumentOrUri]);
      }
    },
    {
      enabledWhen: (editorDocumentOrUri: EditorDocument | string) => {
        const uri = typeof editorDocumentOrUri === 'string' ? editorDocumentOrUri : editorDocumentOrUri.uri;
        return editorDocumentOrUri != null && bifrost.env.isElectron && bifrost.files.isLocalFilename(uri);
      },
    },
  );

  commands.register(
    'std.shell.revealUniqueContainingFolders',
    async (uris: string[]) => {
      const folderUris = new Set<string>();
      for (const uri of uris) {
        const isDir = await bifrost.files.isDirectory(uri);
        if (isDir) {
          folderUris.add(uri);
        } else {
          folderUris.add(uri.replace(/\/[^/]+$/, ''));
        }
      }
      for (const folderUri of folderUris) {
        await commands.executeCommand('std.shell.showDocumentInFileManager', [folderUri]);
      }
    },
    { enabledWhen: () => bifrost.env.isElectron },
  );

  commands.register(
    'std.shell.showLogDirectoryInFileManager',
    () => {
      if (commands.isCommandEnabled('std.shell.showLogDirectoryInFileManager.electron')) {
        commands.executeCommand('std.shell.showLogDirectoryInFileManager.electron');
      }
    },
    {
      visibleInSearch: true,
      description: `Support: Reveal logs in ${bifrost.env.isMac ? 'Finder' : 'Explorer'}`,
      enabledWhen: () =>
        bifrost.env.isElectron && commands.isRegistered('std.shell.showLogDirectoryInFileManager.electron'),
    },
  );

  commands.register(
    'std.shell.showApplicationPath',
    () => {
      if (commands.isRegistered('std.shell.showApplicationPath.electron')) {
        commands.executeCommand('std.shell.showApplicationPath.electron');
      }
    },
    {
      visibleInSearch: true,
      description: 'Support: Show Application Path',
      enabledWhen: () => bifrost.env.isElectron,
    },
  );
}
