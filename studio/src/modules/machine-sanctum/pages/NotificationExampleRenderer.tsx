import type { Bifrost } from '#bifrost/Bifrost';
import { NotificationManager } from '#bifrost/common/NotificationManager';
import type { NotificationOptions } from '#bifrost/contracts/NotificationTypes';
import { ErrorBoundary } from '#components/ErrorBoundary';
import NotificationRenderer from '#components/notifications/NotificationRenderer';

import React from 'react';

import { Icon } from '@evil/bifrost_fw_sdk';

import { JsonExampleRenderer } from './JsonExampleRenderer';

export type NotificationExampleRendererProps = {
  bifrost: Bifrost;
  title?: string;
  viewMediatorId: string;
  data: NotificationOptions;
};

export class NotificationExampleRenderer extends JsonExampleRenderer<NotificationExampleRendererProps> {
  render(): React.JSX.Element {
    const options = NotificationManager.normalizeNotificationOptions(this.state.currentData);
    const responseCallback = (response: any): void => {
      this.bifrost.notifications.open(`Notification response was "${response}".`);
    };
    const showNotification = (options: any): void => {
      this.bifrost.notifications.open(options, responseCallback);
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
              <NotificationRenderer options={options} responseCallback={responseCallback} iconComponent={Icon} />
            </ErrorBoundary>
          </div>
          <div className="machine-sanctum-example__interaction-options">
            <span onClick={() => showNotification(this.state.currentData)} className="btn btn-info">
              Launch this notification
            </span>
          </div>
        </div>
        <div className="col-6">
          <div className="machine-sanctum-example__monaco">{this.renderMonacoEditor()}</div>
          {hint}
          <a className="machine-sanctum-example__reset-data" href="#" onClick={() => this.resetExampleData()}>
            Reset data
          </a>
        </div>
      </div>
    );
  }
}
