import type { Bifrost } from '#bifrost/Bifrost';
import type { QuickJumpItem } from '#bifrost/contracts/QuickJumpTypes';
import { ErrorBoundary } from '#components/ErrorBoundary';
import { Icon } from '#components/Icon';
import QuickJumpRenderer from '#components/quick_jump/QuickJumpRenderer';

import React from 'react';

import { JsonExampleRenderer } from './JsonExampleRenderer';

type QuickJumpExampleRendererProps = {
  title: string;
  data: string;
  bifrost: Bifrost;
  viewMediatorId: string;
};

export class QuickJumpExampleRenderer extends JsonExampleRenderer<QuickJumpExampleRendererProps> {
  render(): React.JSX.Element {
    let hint = <span>Change the values to see live effects.</span>;

    if (!this.state.valueIsValid) {
      hint = <span>Warning: This JSON is not valid!</span>;
    }

    return (
      <div className="row">
        <div className="machine-sanctum-example col-6">
          <h3>{this.props.title}</h3>
          <div className="machine-sanctum-example__component-wrapper">
            <ErrorBoundary>
              <QuickJumpRenderer
                prompt={this.state.currentData.prompt}
                entries={this.state.currentData.entries}
                iconComponent={Icon}
                setQuery={(query: string) => null}
                onBlur={() => null}
                openEntryAndClose={(entry: QuickJumpItem, event: any) => null}
                openSelectedEntryAndClose={(event: any) => null}
              />
            </ErrorBoundary>
          </div>
          <div className="machine-sanctum-example__interaction-options">
            <span onClick={() => this.props.bifrost.quickJump.show(this.state.currentData)} className="btn btn-info">
              Launch this QuickJump
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
