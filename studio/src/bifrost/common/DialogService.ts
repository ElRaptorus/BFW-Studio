import type { Dialog } from '@evil/bifrost_fw_sdk';
import { AbstractEmitter } from '@evil/bifrost_fw_sdk';

import { EVENT_CLOSE_DIALOG, EVENT_OPEN_DIALOG } from '../../../../studio-sdk/src/contracts/internal/DialogEvents';

/**
 * `DialogService` is used to open and close custom HTML-based dialogs.
 *
 * See `DialogService` for using native dialogs in the Electron client.
 */
export class DialogService extends AbstractEmitter {
  close(): void {
    this.emit(EVENT_CLOSE_DIALOG);
  }

  open(dialog: Dialog): void {
    this.emit(EVENT_OPEN_DIALOG, [dialog]);
  }
}
