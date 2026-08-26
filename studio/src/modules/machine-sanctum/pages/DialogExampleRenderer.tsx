import type { Bifrost } from '#bifrost/Bifrost';
import type { DialogOptions, DialogResult } from '#bifrost/contracts/DialogTypes';
import { ErrorBoundary } from '#components/ErrorBoundary';
import { Icon } from '#components/Icon';
import DialogRenderer from '#components/dialog/DialogRenderer';

import React from 'react';

import { JsonExampleRenderer } from './JsonExampleRenderer';

export type DialogExampleRendererProps = {
  bifrost: Bifrost;
  title?: string;
  viewMediatorId: string;
  data: DialogOptions;
};

export class DialogExampleRenderer extends JsonExampleRenderer<DialogExampleRendererProps> {
  render(): React.JSX.Element {
    const bifrost: Bifrost = this.props.bifrost;
    const dialogOptions = bifrost.dialog.normalizeDialogOptions(this.state.currentData);

    const dialogCallback = async (dialogResult: DialogResult): Promise<void> => {
      bifrost.notifications.open(
        `Dialog response was "${dialogResult.response}", formData was ${JSON.stringify(dialogResult.formData)}.`,
      );
    };

    const showMessageBox = async (options: DialogOptions): Promise<void> => {
      const dialogResult = await bifrost.dialog.open(options);
      dialogCallback.apply(null, [dialogResult]);
    };

    let hint = <span>Change the values to see live effects.</span>;

    if (!this.state.valueIsValid) {
      hint = <span>Warning: This JSON is not valid!</span>;
    }

    return (
      <div className="row">
        <div className="machine-sanctum-example col-6">
          <div className="machine-sanctum-example__component-wrapper">
            <ErrorBoundary>
              <DialogRenderer
                iconComponent={Icon}
                options={dialogOptions}
                responseCallback={dialogCallback}
                noFocus={true}
              />
            </ErrorBoundary>
          </div>
          <div className="machine-sanctum-example__interaction-options">
            <span onClick={() => showMessageBox(dialogOptions)} className="btn btn-info">
              Launch this dialog
            </span>
          </div>
        </div>
        <div className="col-6">
          <div className="machine-sanctum-example__code-editor">{this.renderCodeEditor()}</div>
          {hint}
          <a className="machine-sanctum-example__reset-data" href="#" onClick={() => this.resetExampleData()}>
            Reset data
          </a>
        </div>
      </div>
    );
  }
}
