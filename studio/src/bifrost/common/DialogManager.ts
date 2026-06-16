import type {
  Dialog,
  DialogAction,
  DialogActionObject,
  DialogContentObject,
  DialogContentStrict,
  DialogOptions,
  DialogOptionsStrict,
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

const DEFAULT_DIALOG_OPTIONS_TYPE = 'custom';

/**
 * `DialogManager` provides the business logic around queueing, displaying and validating dialogs and their results.
 */
export class DialogManager extends AbstractEmitter {
  private dialogService: DialogService;
  private dialogQueue: Dialog[];
  private activeDialog: Dialog | null;
  private counter: number;

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
    const dialogResult = await this.open({ type: 'open-file', ...dialogOptions });
    assertNotNull(dialogResult.formData, 'dialogResult.formData');

    return dialogResult.formData.filenames;
  }

  async showOpenDirectory(): Promise<string[] | null> {
    const dialogResult = await this.open({ type: 'open-directory' });
    assertNotNull(dialogResult.formData, 'dialogResult.formData');

    return dialogResult.formData.filenames;
  }

  async showSaveFile(dialogOptions: Omit<DialogOptionsStrict_SaveFile, 'type'> = {}): Promise<string | null> {
    const dialogResult = await this.open({ type: 'save-file', ...dialogOptions });
    assertNotNull(dialogResult.formData, 'dialogResult.formData');

    return dialogResult.formData.filename;
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
