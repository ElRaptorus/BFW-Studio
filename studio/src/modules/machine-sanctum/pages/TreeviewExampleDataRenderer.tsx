import { ErrorBoundary } from '#components/ErrorBoundary';

import React from 'react';

import type { Studio, TreeItem } from '@evil/bifrost_fw_sdk';
import { Icon, Tree } from '@evil/bifrost_fw_sdk';

import { JsonExampleRenderer } from './JsonExampleRenderer';

export type TreeviewExampleData = {
  entries: TreeItem[];
};

export type TreeviewExampleDataRendererProps = {
  bifrost: Studio;
  title: string;
  content?: string | string[];
  viewMediatorId: string;
  data: TreeviewExampleData;
};

export class TreeviewExampleDataRenderer extends JsonExampleRenderer<TreeviewExampleDataRendererProps> {
  render(): React.JSX.Element {
    let hint = <span>Change the values to see live effects.</span>;

    if (!this.state.valueIsValid) {
      hint = <span>Warning: This JSON is not valid!</span>;
    }

    return (
      <>
        <div className="row">
          <div className="col">
            <h4>{this.props.title}</h4>
            <ExampleContent content={this.props.content} />
          </div>
        </div>
        <div className="row">
          <div className="machine-sanctum-example col-6">
            <div className="machine-sanctum-example__component-wrapper" style={{ width: 300 }}>
              <ErrorBoundary>
                <Tree
                  studio={this.props.bifrost}
                  viewMediatorId={this.props.viewMediatorId}
                  entries={this.state.currentData.entries}
                  iconComponent={Icon}
                  onClick={() => null}
                />
              </ErrorBoundary>
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
      </>
    );
  }
}

function ExampleContent(props: any): React.JSX.Element | null {
  if (props.content == null) {
    return null;
  }

  const contents = Array.isArray(props.content) ? props.content : [props.content];

  return contents.map((content: string) => {
    return <p key={content}>{content}</p>;
  });
}
