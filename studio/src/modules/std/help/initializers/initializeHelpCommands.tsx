import type { Bifrost } from '#bifrost/Bifrost';

import React from 'react';

import { DEFAULT_HELP_TEXT_ID } from '..';

type UriAndTitle = {
  uri: string;
  title: string;
};

export function initializeHelpCommands(bifrost: Bifrost): void {
  const getUriAndTitle = (givenHelpTextId?: string): UriAndTitle => {
    const helpTextId = givenHelpTextId ?? DEFAULT_HELP_TEXT_ID;
    const helpText = bifrost.helpTexts.getHelpText(helpTextId);
    const uri = `help://${helpTextId}`;
    const title = helpText?.metadata.title ?? 'Help';

    return { uri, title };
  };

  bifrost.commands.register(
    'std.help.open',
    (helpTextId?: string) => {
      const { uri, title } = getUriAndTitle(helpTextId);
      bifrost.commands.executeCommand('std.editor.focusOrOpenDocument', [uri, title]);
    },
    { visibleInSearch: true, description: 'View: Help' },
  );

  bifrost.commands.register('std.help.openToTheSide', (helpTextId?: string) => {
    const { uri, title } = getUriAndTitle(helpTextId);
    bifrost.commands.executeCommand('std.editor.openDocumentToTheSide', [uri, title]);
  });

  const keystrokeFor = (commandName: string): React.JSX.Element => (
    <code className="keystroke">{bifrost.keybindings.getFormattedKeystrokeForCommand(commandName)}</code>
  );

  const tips = [
    <>Use {keystrokeFor('std.quickJump.show')} any time to quickly jump between files.</>,
    <>Use {keystrokeFor('std.quickJump.showCommands')} any time to access the command prompt.</>,
    <>Use {keystrokeFor('std.workbench.toggleFocusMode')} to toggle Focus Mode.</>,
    <>Use {keystrokeFor('std.workbench.togglePanels')} to quickly toggle the left and right panes.</>,
    <>
      When modelling a BPMN, you can use {keystrokeFor('std.editor.undoInFocusedEditorDocument')} to quickly undo
      changes and {keystrokeFor('std.editor.redoInFocusedEditorDocument')} to redo them.
    </>,
    <>Quickly create a new BPMN with {keystrokeFor('std.solution.newFile')}</>,
    <>You can open single files, folders, or create whole solutions from many different folders</>,
    <>
      Use {keystrokeFor('std.editor.focusNextDocument')} and {keystrokeFor('std.editor.focusPrevDocument')} to quickly
      navigate back and forth between open documents.
    </>,
    <>
      You can search an open BPMN document for keywords by using {keystrokeFor('std.editor.showAndFocusInlineSearch')}{' '}
      to access the inline search.
    </>,
    <>You can choose a dark or light theme.</>,
    <>You can use the Documentation Inspector to get extensive information about the currently focused document.</>,
    <>The project-wide fulltext search works for any supported file type.</>,
    <>
      You can directly compare a BPMN with another by right-clicking a file and choosing <strong>Compare to...</strong>.
    </>,
    <>
      The menubar in the top-right corner allows you to quickly deploy and execute the focused BPMN with the Debugger.
    </>,
    <>Use the &quot;View&quot; Menu to customize your Studio&apos;s appearance and layout.</>,
    <>
      Activating &quot;Restore previous Session on startup&quot; makes the Studio remember its current open solution and
      layout.
    </>,
    <>
      When using the Debugger, you can use {keystrokeFor('engine.debugger.workbench.openAndFocusExpressionRunner')} to
      access its Expression Runner. Here you can simulate Runtime Expressions for the currently selected Flow Node
      Instance.
    </>,
  ];
  const tipIndex = Math.floor(tips.length * Math.random());
  const tip = tips[tipIndex];

  bifrost.commands.register<React.JSX.Element>('std.help.getDidYouKnowText', () => tip);
}
