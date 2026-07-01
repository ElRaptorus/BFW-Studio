import type {
  DialogOptions,
  DialogOptionsStrict_OpenDirectory,
  DialogOptionsStrict_OpenFile,
  DialogOptionsStrict_SaveFile,
  DialogResult,
  DialogValidationCallbackFn,
} from '../../src/contracts/DialogTypes';

/**
 * `DialogManager` provides the business logic around queueing, displaying and validating dialogs and their results.
 */
export declare class DialogManager {
  /**
   * Closes the current dialog.
   */
  close(): void;

  /**
   * Returns `true` if there is an active dialog.
   */
  isActive(): boolean;

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
   *    const dialogResult: DialogResult = await studio.dialog.open(dialogOptions);
   *
   *    // `dialogResult.response` now contains 'cancel', 'close' or 'save-and-close'
   *
   *
   */
  open(dialogOptions: DialogOptions, dialogValidationCallbackFn?: DialogValidationCallbackFn): Promise<DialogResult>;

  /**
   * Prompts the user to enter a text.
   *
   * `prompt` is a convenience method for requesting trivial user input. Use `open` for more sophisticated needs.
   */
  prompt(title: string, placeholder?: string): Promise<string | null>;

  /**
   * Shows a (native) dialog to open a file.
   */
  showOpenFile(dialogOptions?: Omit<DialogOptionsStrict_OpenFile, 'type'>): Promise<string[] | null>;

  /**
   * Shows a (native) dialog to open a directory.
   */
  showOpenDirectory(dialogOptions?: Omit<DialogOptionsStrict_OpenDirectory, 'type'>): Promise<string[] | null>;

  /**
   * Shows a (native) dialog to save a file.
   */
  showSaveFile(dialogOptions?: Omit<DialogOptionsStrict_SaveFile, 'type'>): Promise<string | null>;
}
