import React, { Fragment } from 'react';

import { useBifrost } from '../../bifrostContext';

export function EditorAreaEmptyState(): React.JSX.Element {
  const bifrost = useBifrost();
  const cmd = bifrost.commands.getClickHandler();
  const keystroke = (command: string): string => bifrost.keybindings.getFormattedKeystrokeForCommand(command);
  const tip = bifrost.commands.executeCommand<React.JSX.Element>('std.help.getDidYouKnowText');
  const extraActions = bifrost.commands.isRegistered('std.editorEmptyState.getExtraActions')
    ? bifrost.commands.executeCommand<React.JSX.Element[]>('std.editorEmptyState.getExtraActions')
    : undefined;

  return (
    <div className="editor-area-empty-state">
      <dl className="editor-area-empty-state__shortcuts">
        <div className="editor-area-empty-state__shortcut-row">
          <dt>
            <span className="keystroke">{keystroke('std.quickJump.show')}</span>
          </dt>
          <dd>Jump to File</dd>
        </div>
        <div className="editor-area-empty-state__shortcut-row">
          <dt>
            <span className="keystroke">{keystroke('std.quickJump.showCommands')}</span>
          </dt>
          <dd>Commands</dd>
        </div>
        <div className="editor-area-empty-state__shortcut-row">
          <dt>
            <span className="keystroke">{keystroke('std.editor.reopenRecentlyClosedDocument')}</span>
          </dt>
          <dd>Reopen Closed Tab</dd>
        </div>
        <div className="editor-area-empty-state__shortcut-row">
          <dt>
            <span className="keystroke">{keystroke('std.workbench.togglePanels')}</span>
          </dt>
          <dd>Toggle Panels</dd>
        </div>
      </dl>

      <div className="editor-area-empty-state__actions">
        <button className="editor-area-empty-state__action" onClick={cmd('bpmn.editor.newBpmnDocument')}>
          + New BPMN
        </button>
        <button className="editor-area-empty-state__action" onClick={cmd('dmn.editor.newDmnDocument')}>
          + New DMN
        </button>
        <button className="editor-area-empty-state__action" onClick={cmd('std.solution.createSolution')}>
          + New Solution
        </button>
        {extraActions?.map((action) => (
          <Fragment key={extraActionKey(action)}>{action}</Fragment>
        ))}
      </div>

      <p className="editor-area-empty-state__tip">
        <b>Did you know?</b> {tip}
      </p>
    </div>
  );
}

function extraActionKey(action: React.JSX.Element): React.Key {
  if (action.key != null) {
    return action.key;
  }
  const actionProps = action.props as { children?: unknown; className?: string };
  if (typeof actionProps.children === 'string') {
    return actionProps.children;
  }
  if (typeof actionProps.className === 'string') {
    return actionProps.className;
  }
  return String(action.type);
}
