import React from 'react';

import type { Studio } from '../../../types/Studio';
import { Icon } from '../internal/Icon';

type EditorToolbarButtonProps = {
  studio: Studio;

  /**
   * A set of additional CSS class names.
   */
  className?: string;

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

  /**
   * The name of the command that should be executed, e.g. "std.editor.splitToTheRight".
   */
  command: string;

  /**
   * Optional arguments to the command that should be executed.
   */
  commandArgs?: any[];
};

/**
 * Describes a button in the EditorToolbar section of a document.
 *
 * The button is automatically deactivated when the associated command is not enabled.
 */
export function EditorToolbarButton(props: EditorToolbarButtonProps): React.JSX.Element {
  const studio: Studio = props.studio;
  const cmd = studio.commands.getClickHandler();
  const commandEnabled = studio.commands.isCommandEnabled(props.command, props.commandArgs);
  const classNames = ['editor-toolbar__button', commandEnabled ? '' : 'editor-toolbar__button--disabled'];
  const htmlProps = {
    onClick: commandEnabled ? cmd(props.command, props.commandArgs) : undefined,
  };

  if (props.className) {
    classNames.push(props.className);
  }

  return (
    <button className={classNames.join(' ')} title={props.tooltip} {...htmlProps}>
      {props.icon && <Icon id={props.icon} />} {props.label}
    </button>
  );
}
