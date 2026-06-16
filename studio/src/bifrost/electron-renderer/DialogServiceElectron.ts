import { ipcRenderer } from 'electron';

import type {
  Dialog,
  DialogOptionsStrict,
  DialogOptionsStrict_MessageBox,
  DialogResponseCallbackFn,
} from '@evil/bifrost_fw_sdk';

import { DialogService } from '../common/DialogService';
import {
  IPC_MESSAGE_SHOW_NATIVE_MESSAGE_BOX,
  IPC_MESSAGE_SHOW_NATIVE_OPEN_DIRECTORY_DIALOG,
  IPC_MESSAGE_SHOW_NATIVE_OPEN_FILE_DIALOG,
  IPC_MESSAGE_SHOW_NATIVE_SAVE_FILE_DIALOG,
} from '../contracts/IpcEvents';

/**
 * `DialogService` is used to open and close native dialogs in the Electron client.
 *
 * For custom dialogs, e.g. with rich content like form elements, see `DialogService`.
 */
export default class DialogServiceElectron extends DialogService {
  open(dialog: Dialog): void {
    const normalizedDialogOptions: DialogOptionsStrict = dialog.options;
    const annotatedResponseCallback: DialogResponseCallbackFn = dialog.responseCallbackFn;

    const useNativeDialog = normalizedDialogOptions.type !== 'custom';

    if (useNativeDialog) {
      switch (normalizedDialogOptions.type) {
        case 'message-box':
          this.showNativeMessageBox(normalizedDialogOptions, annotatedResponseCallback);
          return;
        case 'open-file':
          this.showNativeOpenFileDialog(normalizedDialogOptions).then((filenames) => {
            const wasCancelled = filenames == null;
            annotatedResponseCallback({
              wasCancelled,
              response: wasCancelled ? 'cancel' : 'success',
              formData: { filenames },
            });
          });
          return;
        case 'open-directory':
          this.showNativeOpenDirectoryDialog().then((filenames) => {
            const wasCancelled = filenames == null;
            annotatedResponseCallback({
              wasCancelled,
              response: wasCancelled ? 'cancel' : 'success',
              formData: { filenames },
            });
          });
          return;
        case 'save-file':
          this.showNativeSaveFileDialog(normalizedDialogOptions).then((filename) => {
            const wasCancelled = filename == null;
            annotatedResponseCallback({
              wasCancelled,
              response: wasCancelled ? 'cancel' : 'success',
              formData: { filename },
            });
          });
          return;
      }
    } else {
      super.open(dialog);
    }
  }

  private async showNativeOpenFileDialog(
    options: DialogOptionsStrict = { type: 'open-file' },
  ): Promise<string[] | null> {
    return ipcRenderer.invoke(IPC_MESSAGE_SHOW_NATIVE_OPEN_FILE_DIALOG, options);
  }

  private async showNativeOpenDirectoryDialog(): Promise<string[] | null> {
    return ipcRenderer.invoke(IPC_MESSAGE_SHOW_NATIVE_OPEN_DIRECTORY_DIALOG);
  }

  private async showNativeSaveFileDialog(options?: DialogOptionsStrict): Promise<string | null> {
    if (options?.type !== 'save-file') {
      throw new Error(`Unexpected type: ${options?.type}`);
    }

    return ipcRenderer.invoke(IPC_MESSAGE_SHOW_NATIVE_SAVE_FILE_DIALOG, options);
  }

  private async showNativeMessageBox(
    dialogOptions: DialogOptionsStrict_MessageBox,
    callbackFn: DialogResponseCallbackFn,
  ): Promise<void> {
    const dialogResult = await ipcRenderer.invoke(IPC_MESSAGE_SHOW_NATIVE_MESSAGE_BOX, dialogOptions);
    await callbackFn(dialogResult);
  }
}
