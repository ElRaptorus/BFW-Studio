import type { Command, CommandContext, EditorDocument } from '@evil/bifrost_fw_sdk';
import { AbstractEmitter } from '@evil/bifrost_fw_sdk';

import type { Bifrost } from '../Bifrost';
import { orderedUnify } from '../common/ArrayFunctions';
import {
  EVENT_QUICK_JUMP_ENTRIES_CHANGED,
  EVENT_QUICK_JUMP_HIDE,
  EVENT_QUICK_JUMP_SHOW,
  QuickJumpView,
} from '../common/QuickJumpView';
import type {
  QuickJumpItem,
  QuickJumpItemBadge,
  QuickJumpOptions,
  QuickJumpViewData,
} from '../contracts/QuickJumpTypes';

export class QuickJumpViewMediator extends AbstractEmitter {
  public readonly domClassName: string;
  public readonly domSelector: string;

  private bifrost: Bifrost;
  private quickJump: QuickJumpView;

  constructor(bifrost: Bifrost, domClassName: string | null = null) {
    super();
    this.domClassName = domClassName || bifrost.getGuid(`${this.constructor.name}-`);
    this.domSelector = `.${this.domClassName}`;

    this.bifrost = bifrost;

    this.quickJump = new QuickJumpView((item: QuickJumpItem, query: string, event?: any) =>
      this.performOpenEntry(item, query, event),
    );

    this.quickJump.on(EVENT_QUICK_JUMP_ENTRIES_CHANGED, () => this.emit(EVENT_QUICK_JUMP_ENTRIES_CHANGED));
    this.quickJump.on(EVENT_QUICK_JUMP_SHOW, () => this.emit(EVENT_QUICK_JUMP_SHOW));
    this.quickJump.on(EVENT_QUICK_JUMP_HIDE, () => this.emit(EVENT_QUICK_JUMP_HIDE));
  }

  /**
   * Shows the QuickJump control, initialized with the given `options`, setting an optional `itemFilter`.
   *
   * Example:
   *
   *    bifrost.showQuickJump({
   *      prompt: 'Select favorite color',
   *      entries: [
   *        { type: 'callback', label: 'Red', callbackFn: () => bifrost.commands.executeCommand('set-fav-color', ['Red']) },
   *        { type: 'callback', label: 'Green', callbackFn: () => bifrost.commands.executeCommand('set-fav-color', ['Green']) },
   *        { type: 'callback', label: 'Blue', callbackFn: () => bifrost.commands.executeCommand('set-fav-color', ['Blue']) }
   *      ]
   *    });
   */
  show(options: QuickJumpOptions): void {
    this.quickJump.show(options);
  }

  /**
   * Internal: Shows the "Recent files" QuickJump
   */
  async showRecentFiles(): Promise<void> {
    this.quickJump.show(await this.getQuickJumpOptionsForFiles());
  }

  /**
   * Internal: Shows the Command Search
   */
  showCommands(): void {
    this.quickJump.show(this.getQuickJumpOptionsForCommands());
  }

  /**
   * Internal: Shows the Command Search
   */
  showCommandsMatching(nameFilterRegexp: RegExp, prompt?: string): void {
    this.quickJump.show(this.getQuickJumpOptionsForCommandsMatching(nameFilterRegexp, prompt));
  }

  showCommandsWithNamesAsLabels(): void {
    this.quickJump.show(this.getQuickJumpOptionsForCommandsWithNamesAsLabels());
  }

  // delegators

  openSelectedEntry(): void {
    this.quickJump.openSelectedEntry();
  }

  openSelectedEntryAndClose(): void {
    this.quickJump.openSelectedEntryAndClose();
  }

  openEntry(item: QuickJumpItem): void {
    this.quickJump.openEntry(item);
  }

  openEntryAndClose(entry: QuickJumpItem): void {
    this.quickJump.openEntryAndClose(entry);
  }

  getEntries(): QuickJumpItem[] {
    return this.quickJump.getEntries();
  }

  setQuery(query: string): void {
    this.quickJump.setQuery(query);
  }

  selectPreviousEntry(): void {
    this.quickJump.selectPreviousEntry();
  }

  selectNextEntry(): void {
    this.quickJump.selectNextEntry();
  }

  getViewData(): QuickJumpViewData {
    return this.quickJump.serialize();
  }

  hide(): void {
    this.quickJump.hide();
  }

  hideWithDelay(): void {
    this.quickJump.hideWithDelay();
  }

  private async getQuickJumpEntriesForFiles(): Promise<QuickJumpItem[]> {
    const recentlyOpenedEditorDocumentItems = this.bifrost.recentlyOpened.getRecentlyOpenedEditorDocumentItems();
    const recentlyOpenedEditorDocumentItemsLabelMap = {};
    for (const recentlyOpenedItem of recentlyOpenedEditorDocumentItems) {
      recentlyOpenedEditorDocumentItemsLabelMap[recentlyOpenedItem.uri] = recentlyOpenedItem.label;
    }
    const recentEditorDocumentsUris = recentlyOpenedEditorDocumentItems.map((item) => item.uri);

    const openEditorDocuments = this.bifrost.editors.getOpenEditorDocuments();
    const openEditorDocumentsUris = openEditorDocuments.map((editorDocument: EditorDocument) => editorDocument.uri);

    const solutionEntryUris: string[] = [];
    this.bifrost.fileExplorerView.traverse((entry: any) => {
      if (entry.type === 'file' && entry.metadata?.uri) {
        solutionEntryUris.push(entry.metadata.uri);
      }
    });

    const allRelevantUris = openEditorDocumentsUris.concat(recentEditorDocumentsUris).concat(...solutionEntryUris);
    const uniqRelevantUris = allRelevantUris.filter(
      (x: string, index: number, array: string[]) => array.indexOf(x) === index,
    );

    const allDocumentUris = orderedUnify(uniqRelevantUris, recentEditorDocumentsUris);
    const firstNonRecentDocumentUriIndex = allDocumentUris.findIndex(
      (uri: string) => recentEditorDocumentsUris.indexOf(uri) === -1 && solutionEntryUris.indexOf(uri) !== -1,
    );

    const solutionBaseUri = this.bifrost.solution.getSolution()?.baseUri;
    const fileEntries = await Promise.all(
      allDocumentUris.map(async (editorDocumentUri: string, index: number): Promise<QuickJumpItem> => {
        let label = recentlyOpenedEditorDocumentItemsLabelMap[editorDocumentUri] || editorDocumentUri;
        let sublabel;
        let badges: QuickJumpItemBadge[] | undefined = undefined;

        if (this.bifrost.files.isLocalFilename(editorDocumentUri)) {
          const containingPath = await this.bifrost.files.getLocalDirectory(editorDocumentUri, false);
          const containingPathUri = this.bifrost.files.getUriForFilename(containingPath);
          const containingPathIsInSolution = solutionEntryUris.includes(editorDocumentUri);

          if (solutionBaseUri != null && containingPathIsInSolution) {
            sublabel = containingPathUri.replace(solutionBaseUri, '').replace(/^[/\\]/, '');
          } else {
            sublabel = await this.bifrost.files.getLocalDirectory(containingPathUri, true);
          }

          label = this.bifrost.files.getFilename(editorDocumentUri);
        }

        const editorDocument = openEditorDocuments.find(
          (editorDocument: EditorDocument) => editorDocument.uri === editorDocumentUri,
        );
        if (editorDocument != null) {
          label = editorDocument.label;
        }
        if (recentEditorDocumentsUris.indexOf(editorDocumentUri) === 0) {
          badges = [{ type: 'text', text: 'Recently opened files' }];
        }
        if (index === firstNonRecentDocumentUriIndex) {
          badges = [{ type: 'text', text: 'Files in solution' }];
        }

        let icon;
        if (this.bifrost.editors.hasDocumentTypeDefinitionForUri(editorDocumentUri)) {
          const documentTypeDefinition = this.bifrost.editors.getDocumentTypeDefinitionByUri(editorDocumentUri);
          icon = documentTypeDefinition.icon;
        }

        return {
          type: 'command',
          label: label,
          sublabel: sublabel,
          command: 'std.editor.focusOrOpenDocument',
          commandArgs: [editorDocumentUri],
          badges: badges,
          icon: icon,
        };
      }),
    );

    return fileEntries;
  }

  private getQuickJumpEntriesForCommands(): QuickJumpItem[] {
    const recentlyUsedCommandNames: string[] = this.bifrost.recentlyOpened
      .getRecentlyOpenedItems('command')
      .map((item: any) => item.name);

    const allCommands = this.bifrost.commands.getEnabledCommandsVisibleInSearch();

    const recentCommands = recentlyUsedCommandNames
      .map((name: string) => allCommands.find((command: Command) => command.name === name))
      .filter((command: Command | null | undefined) => command != null) as Command[];

    const restOfCommands = allCommands
      .filter((command: Command) => recentlyUsedCommandNames.indexOf(command.name) === -1)
      .sort((firstCommand, secondCommand): number => {
        const firstCommandDescription = firstCommand.description.toLowerCase();
        const secondCommandDescription = secondCommand.description.toLowerCase();

        return firstCommandDescription.localeCompare(secondCommandDescription);
      });

    const commands = recentCommands.concat(...restOfCommands);
    const firstNonRecentCommandName = restOfCommands[0]?.name;
    const firstNonRecentCommandNameIndex = commands.findIndex((command) => command.name === firstNonRecentCommandName);

    const commandEntries: QuickJumpItem[] = commands.map((command: Command, index: number): QuickJumpItem => {
      let badges: QuickJumpItemBadge[] | undefined = undefined;
      if (recentCommands.indexOf(command) === 0) {
        badges = [{ type: 'text', text: 'Recently used' }];
      }
      if (index === firstNonRecentCommandNameIndex) {
        badges = [{ type: 'text', text: 'All commands' }];
      }

      return {
        type: 'command',
        label: command.description,
        command: command.name,
        addToRecentlyOpened: true,
        formattedKeystroke: this.bifrost.keybindings
          .getAllFormattedKeystrokesForCommand(command.name)
          .map((stroke) => `[${stroke}]`)
          .join(' '),
        badges: badges,
      };
    });

    return commandEntries;
  }

  private getQuickJumpEntriesForCommandsMatching(nameFilterRegexp: RegExp): QuickJumpItem[] {
    const commands = this.bifrost.commands
      .getEnabledCommandsVisibleInSearch()
      .filter((command: Command) => nameFilterRegexp.test(command.name));

    const commandEntries: QuickJumpItem[] = commands.map((command: Command): QuickJumpItem => {
      return {
        type: 'command',
        label: command.description,
        command: command.name,
        addToRecentlyOpened: true,
        formattedKeystroke: this.bifrost.keybindings
          .getAllFormattedKeystrokesForCommand(command.name)
          .map((stroke) => `[${stroke}]`)
          .join(' '),
      };
    });

    return commandEntries;
  }

  private getQuickJumpEntriesForCommandsWithNamesAsLabels(): QuickJumpItem[] {
    const allCommands = this.bifrost.commands
      .getCommands()
      .filter((command: Command) => command.visibleInSearch && this.bifrost.commands.isCommandEnabled(command.name));

    return allCommands.map((command: Command): QuickJumpItem => {
      return {
        type: 'command',
        label: command.name,
        command: command.name,
        addToRecentlyOpened: true,
        formattedKeystroke: this.bifrost.keybindings
          .getAllFormattedKeystrokesForCommand(command.name)
          .map((stroke) => `[${stroke}]`)
          .join(' '),
      };
    });
  }

  private getQuickJumpOptionsForCommands(): QuickJumpOptions {
    const entries = this.getQuickJumpEntriesForCommands();

    return {
      prompt: 'Select a command by typing ...',
      entries: entries,
    };
  }

  private getQuickJumpOptionsForCommandsMatching(nameFilterRegexp: RegExp, prompt?: string): QuickJumpOptions {
    const entries = this.getQuickJumpEntriesForCommandsMatching(nameFilterRegexp);

    return {
      prompt: prompt ?? 'Select a command by typing ...',
      entries: entries,
    };
  }

  private getQuickJumpOptionsForCommandsWithNamesAsLabels(): QuickJumpOptions {
    const entries = this.getQuickJumpEntriesForCommandsWithNamesAsLabels();

    return {
      prompt: 'Select a command by typing ...',
      entries: entries,
    };
  }

  private async getQuickJumpOptionsForFiles(): Promise<QuickJumpOptions> {
    const entries = await this.getQuickJumpEntriesForFiles();

    return {
      prompt: 'Jump to any file by typing ...',
      entries: entries,
    };
  }

  private performOpenEntry(item: QuickJumpItem, query: string, event?: any): void {
    switch (item?.type) {
      case undefined:
      case null:
        // TODO: Add some kind of default command that can be called for an empty QuickJump list.
        console.log('There was no command to call. QuickJump was closed.');
        return;
      case 'command': {
        const commandName = item.command;
        const commandArgs = item.commandArgs || [];
        const commandContext: CommandContext = {
          type: 'generic',
          data: { inputValue: query },
          event: event,
        };

        this.bifrost.commands.executeCommand(commandName, commandArgs, commandContext);

        if (item.addToRecentlyOpened) {
          this.bifrost.recentlyOpened.addRecentlyOpenedCommandItem({ name: commandName });
        }

        return;
      }
      case 'callback':
        item.callbackFn();
        return;
    }

    throw new Error(`This QuickJumpItem has an unrecognized type:\n\n${JSON.stringify(item, null, 2)}`);
  }
}
