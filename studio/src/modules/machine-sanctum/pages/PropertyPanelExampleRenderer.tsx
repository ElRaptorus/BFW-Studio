import type { Bifrost } from '#bifrost/Bifrost';

import React from 'react';

import { AbstractExampleRenderer } from './AbstractExampleRenderer';

type PropertyPanelExampleRendererProps = {
  title: string;
  data: string;
  bifrost: Bifrost;
  viewMediatorId: string;
};

export class PropertyPanelExampleRenderer extends AbstractExampleRenderer<PropertyPanelExampleRendererProps> {
  render(): React.JSX.Element {
    let hint = <span>Change the values to see live effects.</span>;

    if (!this.state.valueIsValid) {
      hint = <span>Warning: This HTML is not valid!</span>;
    }

    const htmlAsString = this.state.currentData.replace(/className=/gi, 'class=');

    return (
      <div>
        <h2>{this.props.title}</h2>
        <div className="row my-1">
          <div className="col-8">
            <div className="machine-sanctum-example__monaco">{this.renderMonacoEditor()}</div>
            {hint}
            <a className="machine-sanctum-example__reset-data" href="#" onClick={() => this.resetExampleData()}>
              Reset data
            </a>
          </div>
          <div className="machine-sanctum-example col mx-4" dangerouslySetInnerHTML={{ __html: htmlAsString }}></div>
        </div>
      </div>
    );
  }

  protected valueIsValid(value: any): boolean {
    return true;
  }

  protected getMonacoLanguage(): string {
    return 'html';
  }

  protected getDataForModel(data: any): any {
    return data;
  }

  protected getDataForRenderer(data: any): string {
    return data;
  }
}
