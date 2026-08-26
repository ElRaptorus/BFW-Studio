import React from 'react';

export type EditorTitleTextSimpleProps = {
  label: string | React.JSX.Element;
  sublabel?: string | React.JSX.Element;
  tooltip?: string;
};

export function EditorTitleTextSimple(props: EditorTitleTextSimpleProps): React.JSX.Element {
  return (
    <div className="editor-title__text" title={props.tooltip} data-bs-toggle="tooltip">
      {props.sublabel && <div className="editor-title__text--small">{props.sublabel}</div>}
      <div className="editor-title__text">{props.label}</div>
    </div>
  );
}
