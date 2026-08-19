import type { Bifrost } from '#bifrost/Bifrost';

import type { CommandContext, DialogOptions, DialogResult, DialogValidationResult } from '@evil/bifrost_fw_sdk';
import { assertGenericCommandContext } from '@evil/bifrost_fw_sdk';

import { initializeEditorCommands } from './commands/initializeEditorCommands';
import { initializeFileExplorerCommands } from './commands/initializeFileExplorerCommands';
import { initializeQuickJumpCommands } from './commands/initializeQuickJumpCommands';
import { initializeShellCommands } from './commands/initializeShellCommands';
import { initializeSolutionCommands } from './commands/initializeSolutionCommands';
import { initializeWorkbenchCommands } from './commands/initializeWorkbenchCommands';

export function initializeCommands(bifrost: Bifrost): void {
  const commands = bifrost.commands;

  initializeQuickJumpCommands(bifrost);
  initializeFileExplorerCommands(bifrost);
  initializeSolutionCommands(bifrost);
  initializeEditorCommands(bifrost);
  initializeWorkbenchCommands(bifrost);
  initializeShellCommands(bifrost);
  if (process.env.APP_TEST == 'true') {
    initializeTestCommands();
  }

  commands.register('std.internal.empty', () => null, { enabledWhen: () => false });

  commands.register('std.noop', () => {});

  commands.register('std.internal.copyToClipboard', (target: HTMLInputElement) => {
    const value = target.value.substring(0);
    const selectionStart = target.selectionStart ?? 0;
    const selectionEnd = target.selectionEnd ?? value.length;
    const noSelection = selectionStart === selectionEnd;
    const selection = noSelection ? value : value.substring(selectionStart, selectionEnd);

    navigator.clipboard.writeText(selection);
  });

  commands.register(
    'std.internal.pasteFromClipboard',
    async (target: HTMLInputElement, setValue?: (value: string) => void) => {
      const value = target.value.substring(0);
      const selectionStart = target.selectionStart ?? 0;
      const selectionEnd = target.selectionEnd ?? value.length;

      const clipboardText = await navigator.clipboard.readText();

      const newValue = value.substring(0, selectionStart) + clipboardText + value.substring(selectionEnd);
      target.value = newValue;
      setValue?.(newValue);
    },
    { enabledWhen: (target: HTMLInputElement) => !target.disabled },
  );

  commands.register(
    'std.internal.cutToClipboard',
    (target: HTMLInputElement, setValue?: (value: string) => void) => {
      const value = target.value.substring(0);
      const selectionStart = target.selectionStart ?? 0;
      const selectionEnd = target.selectionEnd ?? value.length;
      const noSelection = selectionStart === selectionEnd;
      const selection = noSelection ? value : value.substring(selectionStart, selectionEnd);

      navigator.clipboard.writeText(selection);

      const newValue = noSelection ? '' : value.substring(0, selectionStart) + value.substring(selectionEnd);
      target.value = newValue;
      setValue?.(newValue);
    },
    { enabledWhen: (target: HTMLInputElement) => !target.disabled },
  );

  commands.register('std.internal.selectAll', (target: HTMLInputElement) => {
    target.focus();
    target.select();
  });

  commands.register(
    'std.internal.clear',
    (target: HTMLInputElement, setValue?: (value: string) => void) => {
      target.value = '';
      setValue?.('');
      target.focus();
    },
    { enabledWhen: (target: HTMLInputElement) => !target.disabled },
  );

  commands.register('std.internal.notify', (...args: any[]) => bifrost.notifications.open(JSON.stringify(args)));

  bifrost.commands.register('std.window.reload', async () => {
    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.zIndex = '10000000';
    div.style.top = '0';
    div.style.bottom = '0';
    div.style.left = '0';
    div.style.right = '0';
    div.style.backgroundColor = '#2f2f2f';
    document.body.appendChild(div);

    window.location.reload();
  });

  commands.register('std.dialog.close', () => bifrost.dialog.close());

  commands.register('std.dialog.openCopyAndPaste', async (title: string, text: string) => {
    const dialogOptions: DialogOptions = {
      title: title || 'Info',
      content: [
        {
          type: 'text_input',
          id: 'info',
          multiline: /\n/.test(text),
          value: text,
          readonly: true,
          focus: true,
        },
      ],
      actions: [
        { label: 'Close', response: 'close', cancel: true },
        { label: 'Copy & Close', response: 'copyAndClose', default: true },
      ],
    };
    const dialogValidation = async (dialogResult: DialogResult): Promise<DialogValidationResult> => {
      if (dialogResult.response === 'copyAndClose') {
        // This has to happen during validation for the text input to still be present and "copy-able"
        navigator.clipboard.writeText(text);
      }

      return { closeDialog: true };
    };

    await bifrost.dialog.open(dialogOptions, dialogValidation);
  });

  commands.register('std.notifications.showError', (error: any, source?: string) => {
    if (error.type === 'abort') {
      return;
    }

    let content = '';
    if (typeof error == 'string') {
      content = error;
    } else {
      content = error?.stack || error?.message;
    }

    bifrost.notifications.open(
      {
        type: 'error',
        content: content,
        source: source,
        actions: [
          {
            label: 'Show Error',
            action: 'open-dialog',
          },
        ],
      },
      (response) => {
        if (response.action == 'open-dialog') {
          bifrost.commands.executeCommand('std.dialog.openCopyAndPaste', ['Error Message', content]);
        }
      },
    );
  });

  function initializeTestCommands() {
    commands.register(
      'std.test.reportInput',
      (ctx: CommandContext) => {
        assertGenericCommandContext(ctx);

        bifrost.notifications.open(`data was ${JSON.stringify(ctx.data)}`);
      },
      {
        visibleInSearch: true,
        expectsContext: true,
        description: 'Test: Report input',
      },
    );

    commands.register(
      'std.test.throwError',
      () => {
        throw new Error('error in Bifrost command');
      },
      { visibleInSearch: true },
    );

    // Guards the test harness against a WebdriverIO trap: a value returned from
    // `client.execute` that carries a top-level `error` property is parsed as a WebDriver
    // protocol error. StudioAgent.executeCommand therefore envelopes results.
    commands.register('std.test.returnObjectWithErrorProperty', () => ({
      success: false,
      error: 'sentinel-error-value',
    }));

    commands.register(
      'std.test.throwErrorInSettimeout',
      () => {
        setTimeout(() => {
          throw new Error('error in a setTimeout() in a Bifrost command');
        }, 500);
      },
      { visibleInSearch: true },
    );

    bifrost.commands.register(
      'std.test.showAndCloseStickyNotification',
      () => {
        const interval = 50;
        let percent = 0;
        const id = bifrost.notifications.open({ content: `Test ${percent}/100 complete`, sticky: true });
        const updateNotification = () => {
          percent++;
          if (percent > 100) {
            bifrost.notifications.update(id, { content: `Test 100/100 complete`, sticky: true });
          } else {
            bifrost.notifications.update(id, { content: `Test ${percent}/100 complete`, sticky: true });
            setTimeout(() => {
              updateNotification();
            }, interval);
          }
        };
        setTimeout(() => {
          updateNotification();
        }, interval);
      },
      { visibleInSearch: true, description: 'Test: Sticky notification' },
    );

    commands.register(
      'std.test.forceCloseOpenTabs',
      async () => {
        const editorDocuments = bifrost.editors.getOpenEditorDocuments();

        await bifrost.editors.closeEditorDocumentsUntilUserCancels(editorDocuments, true);
      },
      { visibleInSearch: true, description: 'Test: Close all' },
    );

    commands.register(
      'std.test.openUriAsSolution',
      async () => {
        const solutionUri = await bifrost.dialog.prompt(
          'Open URI as solution',
          'Enter a directory URI, e.g. file://documents',
        );
        if (solutionUri == null || solutionUri.trim() === '') {
          return;
        }

        commands.executeCommand('std.solution.openDirectory', [solutionUri]);
      },
      { visibleInSearch: true, description: 'Test: Open URI as solution' },
    );

    commands.register(
      'std.test.openUriAsDocument',
      async () => {
        const documentUri = await bifrost.dialog.prompt(
          'Open URI as document',
          'Enter a document URI, e.g. file://documents/document.bpmn',
        );
        if (documentUri == null || documentUri.trim() === '') {
          return;
        }

        bifrost.editors.focusOrOpenEditorDocument(documentUri);
      },
      { visibleInSearch: true, description: 'Test: Open URI as document' },
    );

    commands.register(
      'std.test.addFolderToSolution',
      async () => {
        const directoryUri = await bifrost.dialog.prompt('Add Folder', 'Enter directory URI');
        if (directoryUri == null || directoryUri.trim() === '') {
          return;
        }
        bifrost.solution.addFolderToSolution(directoryUri);
      },
      { visibleInSearch: true, description: 'Test: Add folder to solution' },
    );

    commands.register(
      'std.test.removeFolderFromSolution',
      async () => {
        const projectId = await bifrost.dialog.prompt('Remove Folder', 'Enter project ID');
        if (projectId == null || projectId.trim() === '') {
          return;
        }
        bifrost.solution.removeFolderFromSolution(projectId);
      },
      { visibleInSearch: true, description: 'Test: Remove folder from solution' },
    );

    commands.register(
      'std.test.renameProjectInSolution',
      async () => {
        const baseUri = await bifrost.dialog.prompt('Rename Project', 'Enter project base URI');
        if (baseUri == null || baseUri.trim() === '') {
          return;
        }
        const newName = await bifrost.dialog.prompt('Rename Project', 'Enter new name');
        if (newName == null || newName.trim() === '') {
          return;
        }
        const solution = bifrost.solution.getSolution();
        const project = solution?.projects.find((solutionProject) => solutionProject.baseUri === baseUri);
        if (project != null) {
          bifrost.solution.renameProjectInSolution(project.id, newName);
        }
      },
      { visibleInSearch: true, description: 'Test: Rename project in solution' },
    );

    commands.register(
      'std.test.closeSolution',
      () => {
        bifrost.solution.closeSolution();
      },
      { visibleInSearch: true, description: 'Test: Close solution' },
    );
  }
}
