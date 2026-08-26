import type { Bifrost } from '#bifrost/Bifrost';
import { renderBifrostMenu } from '#components/ContextMenu';
import { showContextMenu } from '#components/ContextMenuFunctions';
import { ErrorBoundary } from '#components/ErrorBoundary';
import { EditorContent } from '#components/editor/EditorContent';

import React, { Fragment } from 'react';

import type { MachineSanctumExample } from '../contracts/MachineSanctumTypes';

type ContextMenuExampleData = {
  menuId: string;
  menuArgs?: any[];
};

type ContextMenuExample = MachineSanctumExample<ContextMenuExampleData>;
type ContextMenuExampleProps = {
  bifrost: Bifrost;
  title?: string;
  data: ContextMenuExampleData;
};

export default function ContextMenuExamples(props: any): React.JSX.Element {
  const contextMenuPropsArray: ContextMenuExample[] = [
    {
      data: { menuId: 'mock/machine-sanctum' },
    },
  ];

  return (
    <div className="machine-sanctum-subpage">
      <h2>ContextMenu examples</h2>
      <p>TODO: Add introduction to context menus.</p>
      {contextMenuPropsArray.map((contextMenuExample: ContextMenuExample) => (
        <Fragment key={contextMenuExample.data.menuId}>
          <ContextMenuExample bifrost={props.bifrost} data={contextMenuExample.data} />
          <hr />
        </Fragment>
      ))}
    </div>
  );
}

function ContextMenuExample(props: ContextMenuExampleProps): React.JSX.Element {
  const bifrost = props.bifrost;
  const menu = bifrost.menus.getMenuSync(props.data.menuId);

  return (
    <EditorContent>
      <div className="row">
        <div className="machine-sanctum-example col-6">
          <ErrorBoundary>
            <div className="machine-sanctum-example__component-wrapper">
              <nav
                role="menu"
                className="react-contextmenu react-contextmenu--visible"
                style={{ width: 'fit-content' }}
              >
                {renderBifrostMenu(menu, bifrost)}
              </nav>
            </div>
            <div className="machine-sanctum-example__interaction-options">
              <span
                className="btn btn-info"
                onClick={(event) => showContextMenu(event, props.data.menuId)}
                onContextMenu={(event) => showContextMenu(event, props.data.menuId)}
              >
                Click or right-click for live menu
              </span>
            </div>
          </ErrorBoundary>
        </div>
        <div className="col-6">
          {/* prettier-ignore */}
          <pre className="machine-sanctum-example__code">
          TODO: Add code example.
        </pre>
        </div>
      </div>
    </EditorContent>
  );
}
