import React from 'react';

import type { Studio } from '../../../types/Studio';
import { Icon } from '../internal/Icon';

type EditorToolbarTextProps = {
  studio: Studio;

  /**
   * The icon to be displayed, e.g. "std/help".
   */
  icon?: string;

  /**
   * The tooltip to be displayed, e.g. "Show changes".
   */
  tooltip?: string;

  /**
   * An optional label to be displayed, e.g. "Export file ...".
   */
  label?: string | React.JSX.Element;

  children?: any;
};

/**
 * Describes a button in the EditorToolbar section of a document.
 *
 * The button is automatically deactivated when the associated command is not enabled.
 */
export function EditorToolbarText(props: EditorToolbarTextProps): React.JSX.Element {
  return (
    <span className="editor-toolbar__item" title={props.tooltip}>
      {props.icon && <Icon id={props.icon} />} {props.label} {props.children}
    </span>
  );
}
