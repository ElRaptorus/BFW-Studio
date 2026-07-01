import type {
  Dialog,
  DialogAction,
  DialogActionObject,
  DialogContentObject,
  DialogContentStrict,
  DialogOptions,
  DialogOptionsStrict,
  DialogOptionsStrict_OpenDirectory,
  DialogOptionsStrict_OpenFile,
  DialogOptionsStrict_SaveFile,
  DialogResponseCallbackFn,
  DialogResult,
  DialogValidationCallbackFn,
  DialogValidationResult,
} from '@evil/bifrost_fw_sdk';
import { AbstractEmitter, assertNotNull } from '@evil/bifrost_fw_sdk';

import {
  EVENT_CLOSE_DIALOG,
  EVENT_OPEN_DIALOG,
  EVENT_VALIDATED_DIALOG,
} from '../../../../studio-sdk/src/contracts/internal/DialogEvents';
import type { DialogService } from './DialogService';
import type { SettingsMediator } from './SettingsMediator';

const DEFAULT_DIALOG_OPTIONS_TYPE = 'custom';

/**
 * The native dialog families that support directory tracking.
 */
type DialogPathType = 'openFile' | 'openDirectory' | 'saveFile';

/**
 * User-facing setting holding a global fallback directory for native file dialogs.
 */
const SETTING_DEFAULT_DIRECTORY = 'dialog.defaultDirectory';

/**
 * Hidden, auto-tracked "last used directory" setting per native dialog family.
 */
const SETTING_LAST_DIRECTORY: Record<DialogPathType, string> = {
  openFile: 'dialog.internal.lastDirectory.openFile',
  openDirectory: 'dialog.internal.lastDirectory.openDirectory',
  saveFile: 'dialog.internal.lastDirectory.saveFile',
};

/**
 * Collaborators the `DialogManager` needs to resolve and persist default directories.
 * Injected via {@link DialogManager.setPathContext} once the owning `Bifrost` instance
 * has constructed its settings and solution mediators. When absent (e.g. the base
 * browser build), directory tracking degrades to a passthrough.
 */
export type DialogPathContext = {
  settings: Pick<SettingsMediator, 'has' | 'get' | 'set'>;
  getSolutionRoot: () => string | null;
};

/**
 * `DialogManager` provides the business logic around queueing, displaying and validating dialogs and their results.
 */
export class DialogManager extends AbstractEmitter {
  private dialogService: DialogService;
  private dialogQueue: Dialog[];
  private activeDialog: Dialog | null;
  private counter: number;
  private pathContext: DialogPathContext | null = null;

  constructor(dialogService: DialogService) {
    super();

    this.dialogService = dialogService;
    this.dialogService.on(EVENT_CLOSE_DIALOG, () => this.emit(EVENT_CLOSE_DIALOG));
    this.dialogService.on(EVENT_OPEN_DIALOG, (dialog: Dialog) => this.emit(EVENT_OPEN_DIALOG, [dialog]));

    this.dialogQueue = [];
    this.activeDialog = null;
    this.counter = 0;
  }

  /**
   * Injects the collaborators used to resolve and persist native dialog default directories.
   * Called once during `Bifrost` construction, after the settings and solution mediators exist.
   */
  setPathContext(context: DialogPathContext): void {
    this.pathContext = context;
  }

  /**
   * Closes the current dialog.
   */
  close(): void {
    if (this.activeDialog == null) {
      return;
    }
    this.activeDialog.responseCallbackFn({ wasCancelled: true });
  }

  isActive(): boolean {
    return this.activeDialog != null;
  }

  /**
   * Opens a dialog described by the given `dialogOptions`.
   *
   * Returns a `DialogResult` object containing the `response` given by the user and the data entered into the form
   * as `formData` (if any form was described in `dialogOptions`).
   *
   * Takes a validation callback as an optional second parameter.
   *
   * Example:
   *
   *     const dialogOptions: DialogOptions = {
   *      title: 'Unsaved changes',
   *      content: 'Do you want to save your changes before closing the document?',
   *      actions: [
   *        {
   *          response: 'cancel',
   *          label: 'cancel',
   *          cancel: true
   *        },
   *        {
   *          response: 'close',
   *          label: "Don't save and close"
   *        },
   *        {
   *          response: 'save-and-close',
   *          label: 'Save and close',
   *          default: true
   *        }
   *      ]
   *    };
   *
   *    const dialogResult: DialogResult = await bifrost.dialog.open(dialogOptions);
   *
   *    // `dialogResult.response` now contains 'cancel', 'close' or 'save-and-close'
   *
   *
   */
  async open(
    dialogOptions: DialogOptions,
    dialogValidationCallbackFn?: DialogValidationCallbackFn,
  ): Promise<DialogResult> {
    return new Promise((resolve, reject): void => {
      const normalizedDialogOptions = this.normalizeDialogOptions(dialogOptions);
      const dialogResponseCallbackFn = async (dialogResult: DialogResult): Promise<void> => {
        let dialogResultIsValid = false;

        if (dialogValidationCallbackFn == null) {
          dialogResultIsValid = true;
        } else {
          try {
            const validationResult: DialogValidationResult = await dialogValidationCallbackFn.apply(null, [
              dialogResult,
            ]);
            if (validationResult.closeDialog === true) {
              dialogResultIsValid = true;
            } else {
              this.emit(EVENT_VALIDATED_DIALOG, [validationResult]);
            }
          } catch (error) {
            this.onClose();
            reject(error);
            return;
          }
        }

        if (dialogResultIsValid) {
          this.onClose();
          resolve(dialogResult);
        }
      };

      this.openOrAddDialogToQueue(normalizedDialogOptions, dialogResponseCallbackFn);
    });
  }

  async prompt(title: string, placeholder?: string): Promise<string | null> {
    const dialogOptions: DialogOptions = {
      title: title,
      content: [
        {
          type: 'text_input',
          id: 'promptValue',
          placeholder: placeholder,
          focus: true,
        },
      ],
      actions: [
        { label: 'Cancel', response: 'close', cancel: true },
        { label: 'Submit', response: 'submit', default: true },
      ],
    };

    const dialogResult = await this.open(dialogOptions);
    if (dialogResult.response === 'submit') {
      return dialogResult.formData?.promptValue;
    } else {
      return null;
    }
  }

  async showOpenFile(dialogOptions: Omit<DialogOptionsStrict_OpenFile, 'type'> = {}): Promise<string[] | null> {
    const defaultPath = this.resolveDefaultPath('openFile', dialogOptions.defaultPath);
    const dialogResult = await this.open({ type: 'open-file', ...dialogOptions, defaultPath });
    assertNotNull(dialogResult.formData, 'dialogResult.formData');

    const filenames: string[] | null = dialogResult.formData.filenames;
    if (filenames != null && filenames.length > 0) {
      this.recordUsedPath('openFile', filenames[0]);
    }

    return filenames;
  }

  async showOpenDirectory(
    dialogOptions: Omit<DialogOptionsStrict_OpenDirectory, 'type'> = {},
  ): Promise<string[] | null> {
    const defaultPath = this.resolveDefaultPath('openDirectory', dialogOptions.defaultPath);
    const dialogResult = await this.open({ type: 'open-directory', ...dialogOptions, defaultPath });
    assertNotNull(dialogResult.formData, 'dialogResult.formData');

    const filenames: string[] | null = dialogResult.formData.filenames;
    if (filenames != null && filenames.length > 0) {
      this.recordUsedPath('openDirectory', filenames[0]);
    }

    return filenames;
  }

  async showSaveFile(dialogOptions: Omit<DialogOptionsStrict_SaveFile, 'type'> = {}): Promise<string | null> {
    const defaultPath = this.resolveDefaultPath('saveFile', dialogOptions.defaultPath);
    const dialogResult = await this.open({ type: 'save-file', ...dialogOptions, defaultPath });
    assertNotNull(dialogResult.formData, 'dialogResult.formData');

    const filename: string | null = dialogResult.formData.filename;
    if (filename != null && filename !== '') {
      this.recordUsedPath('saveFile', filename);
    }

    return filename;
  }

  /**
   * Resolves the `defaultPath` to hand to a native dialog, restoring the "remember last
   * directory" behavior that Electron dropped in v43.
   *
   * Priority:
   * 1. An explicit absolute `defaultPath` from the caller is used as-is.
   * 2. An explicit relative `defaultPath` (a bare filename) is joined onto the resolved directory.
   * 3. Last-used directory for this dialog family.
   * 4. The user-configured `dialog.defaultDirectory` setting.
   * 5. The current solution root.
   *
   * When nothing resolves, `undefined` is returned and the Electron main process applies the
   * final home-directory fallback (keeping this renderer code free of Node `os`/`path` imports).
   */
  private resolveDefaultPath(dialogType: DialogPathType, explicitDefault?: string): string | undefined {
    const hasExplicit = explicitDefault != null && explicitDefault !== '';

    if (hasExplicit && isAbsolutePath(explicitDefault)) {
      return explicitDefault;
    }

    if (this.pathContext == null) {
      return explicitDefault;
    }

    const baseDirectory = this.resolveBaseDirectory(dialogType);

    if (hasExplicit) {
      return baseDirectory != null ? joinPath(baseDirectory, explicitDefault) : explicitDefault;
    }

    return baseDirectory ?? undefined;
  }

  /**
   * Resolves the base directory for a dialog family from (in order) the last-used directory,
   * the user setting, and the solution root. Returns `null` when none apply.
   */
  private resolveBaseDirectory(dialogType: DialogPathType): string | null {
    const context = this.pathContext;
    if (context == null) {
      return null;
    }

    const lastDirectoryKey = SETTING_LAST_DIRECTORY[dialogType];
    if (context.settings.has(lastDirectoryKey)) {
      const lastDirectory = context.settings.get(lastDirectoryKey);
      if (typeof lastDirectory === 'string' && lastDirectory.trim() !== '') {
        return lastDirectory;
      }
    }

    if (context.settings.has(SETTING_DEFAULT_DIRECTORY)) {
      const configuredDirectory = context.settings.get(SETTING_DEFAULT_DIRECTORY);
      if (typeof configuredDirectory === 'string' && configuredDirectory.trim() !== '') {
        return configuredDirectory;
      }
    }

    const solutionRoot = context.getSolutionRoot();
    if (solutionRoot != null && solutionRoot.trim() !== '') {
      return solutionRoot;
    }

    return null;
  }

  /**
   * Persists the directory of the user's selection so the next dialog of the same family reopens there.
   * For directory pickers, the parent of the chosen folder is stored so the dialog reopens showing it.
   */
  private recordUsedPath(dialogType: DialogPathType, selectedPath: string): void {
    const context = this.pathContext;
    if (context == null || selectedPath == null || selectedPath === '') {
      return;
    }

    const directory = dirnameOf(selectedPath);
    if (directory === '') {
      return;
    }

    context.settings.set(SETTING_LAST_DIRECTORY[dialogType], directory);
  }

  normalizeDialogOptions(dialogOptions: DialogOptions): DialogOptionsStrict {
    if (
      dialogOptions.type === 'open-directory' ||
      dialogOptions.type === 'open-file' ||
      dialogOptions.type === 'save-file'
    ) {
      return dialogOptions;
    }

    const normalizedActions = (dialogOptions.actions || [])
      .slice()
      .map((action) => this.normalizeDialogOptionAction(action));

    const contentAsArray = Array.isArray(dialogOptions.content) ? dialogOptions.content : [dialogOptions.content];

    const normalizedContent: DialogContentStrict = contentAsArray.map((contentItem: string | DialogContentObject) =>
      this.normalizeDialogOptionContent(contentItem),
    );

    switch (dialogOptions.type) {
      case null:
      case undefined:
      case 'custom':
        return {
          ...dialogOptions,
          type: dialogOptions.type || DEFAULT_DIALOG_OPTIONS_TYPE,
          content: normalizedContent,
          actions: normalizedActions,
        };
      case 'message-box': {
        const type = dialogOptions.type;

        return { type, content: normalizedContent, actions: normalizedActions };
      }
    }

    throw new Error(`Could not normalize DialogOptions: ${JSON.stringify(dialogOptions, null, 2)}`);
  }

  submit(response: string, formData?: any): void {
    assertNotNull(this.activeDialog, 'this.activeDialog');

    const dialogResult: DialogResult = {
      wasCancelled: false,
      response,
      formData,
    };

    this.activeDialog.responseCallbackFn(dialogResult);
  }

  private onClose(): void {
    this.activeDialog = null;
    this.dialogService.close();
    this.tryToActivateNextDialogFromQueue();
  }

  private normalizeDialogOptionAction(action: DialogAction): DialogActionObject {
    let result = action;

    if (typeof result === 'string') {
      result = { response: result, label: this.getDefaultLabel(result) };
    }

    return result;
  }

  private normalizeDialogOptionContent(content: string | DialogContentObject): DialogContentObject {
    let result = content;

    if (typeof result === 'string') {
      result = { type: 'markdown', text: result };
    }

    return result;
  }

  private getDefaultLabel(response: string): string {
    return response.charAt(0).toUpperCase() + response.substring(1);
  }

  private openOrAddDialogToQueue(
    normalizedDialogOptions: DialogOptionsStrict,
    dialogResponseCallbackFn: DialogResponseCallbackFn,
  ): void {
    const queuedDialog: Dialog = {
      id: `dialog-${this.getNextDialogNumber()}`,
      options: normalizedDialogOptions,
      responseCallbackFn: dialogResponseCallbackFn,
    };
    this.dialogQueue.push(queuedDialog);

    this.tryToActivateNextDialogFromQueue();
  }

  private tryToActivateNextDialogFromQueue(): void {
    if (this.activeDialog != null) {
      return;
    }

    const nextDialog = this.dialogQueue.shift();

    if (nextDialog == null) {
      return;
    }

    this.activeDialog = nextDialog;
    this.dialogService.open(nextDialog);
  }

  private getNextDialogNumber(): number {
    this.counter++;
    return this.counter;
  }
}

/**
 * Pure, cross-platform path helpers. `DialogManager` is bundled for both the browser and Electron,
 * so it must not import Node's `path`/`os`. These helpers infer the separator from the input and
 * cover the small amount of manipulation needed for directory tracking.
 */

/** Removes trailing `/` or `\` separators (but preserves a lone root such as `/`). */
function stripTrailingSeparators(inputPath: string): string {
  const stripped = inputPath.replace(/[\\/]+$/, '');
  return stripped === '' ? inputPath.slice(0, 1) : stripped;
}

/** True for POSIX (`/foo`), Windows drive (`C:\foo`, `C:/foo`), and UNC (`\\host`) absolute paths. */
function isAbsolutePath(inputPath: string): boolean {
  return /^([a-zA-Z]:[\\/]|\\\\|\/)/.test(inputPath);
}

/** Returns the directory portion of a path, or `''` when there is no separator. */
function dirnameOf(inputPath: string): string {
  const stripped = stripTrailingSeparators(inputPath);
  const lastSeparatorIndex = Math.max(stripped.lastIndexOf('/'), stripped.lastIndexOf('\\'));

  if (lastSeparatorIndex < 0) {
    return '';
  }

  if (lastSeparatorIndex === 0) {
    return stripped.slice(0, 1);
  }

  const head = stripped.slice(0, lastSeparatorIndex);
  if (/^[a-zA-Z]:$/.test(head)) {
    return stripped.slice(0, lastSeparatorIndex + 1);
  }

  return head;
}

/** Joins a filename onto a directory using the directory's own separator style. */
function joinPath(directory: string, name: string): string {
  const separator = directory.includes('\\') && !directory.includes('/') ? '\\' : '/';
  return `${stripTrailingSeparators(directory)}${separator}${name}`;
}
