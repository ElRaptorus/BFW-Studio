import type { Bifrost } from '#bifrost/Bifrost';

import React, { Fragment } from 'react';

export type FeelExpressionHintProps = {
  className?: string;
  title?: string;
  studio: Bifrost;
};

export type LabelWithFeelExpressionHintProps = {
  label: React.JSX.Element | string;
  studio: Bifrost;
};

export function LabelWithFeelExpressionHint(props: LabelWithFeelExpressionHintProps): React.JSX.Element {
  return (
    <Fragment>
      {props.label} <FeelExpressionHint className="float-right" studio={props.studio} />
    </Fragment>
  );
}

export function FeelExpressionHint(props: FeelExpressionHintProps): React.JSX.Element {
  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    const uri = 'help://bpmn/runtime_expressions';

    if (event.shiftKey) {
      props.studio.commands.executeCommand('std.editor.openDocumentToTheSide', [uri]);
    } else {
      props.studio.commands.executeCommand('std.editor.focusOrOpenDocument', [uri]);
    }
  };

  return (
    <a
      href="#"
      onClick={handleClick}
      className={`runtime-expressions-hint ${props.className || ''}`}
      data-bs-toggle="tooltip"
      title={props.title || 'FEEL Expression'}
    >
      FEEL
    </a>
  );
}
