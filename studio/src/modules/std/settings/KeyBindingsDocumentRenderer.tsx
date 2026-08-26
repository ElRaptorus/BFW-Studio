import type { EditorDocumentRendererProps } from '#bifrost/contracts/EditorTypes';
import { MultiLineCodeEditor } from '#components/MultiLineCodeEditor';
import { Editor } from '#components/editor/Editor';
import { EditorContent } from '#components/editor/EditorContent';
import { EditorToolbar } from '#components/editor/EditorToolbar';
import { EditorToolbarLeft } from '#components/editor/EditorToolbarLeft';
import { EditorToolbarText } from '#components/editor/EditorToolbarText';
import * as jsonComment from 'comment-json';

import React from 'react';

export default function KeyBindingsRenderer(props: EditorDocumentRendererProps): React.JSX.Element {
  const keyBindings = props.studio.keybindings.getAllKeyBindings();

  for (const keyBinding of Object.keys(keyBindings)) {
    keyBindings[keyBinding] = keyBindings[keyBinding].filter((value, index, self) => index === self.indexOf(value));
  }
  const keybindingsAsString = jsonComment.stringify(keyBindings, null, 2);

  return (
    <Editor>
      <EditorToolbar>
        <EditorToolbarLeft>
          <EditorToolbarText
            studio={props.studio}
            label="Lists all Studio key bindings and the commands for which they are used."
          />
        </EditorToolbarLeft>
      </EditorToolbar>
      <EditorContent>
        <div className="settings" data-test-key-bindings>
          <MultiLineCodeEditor
            initialValue={keybindingsAsString}
            language="json"
            lineNumbers={true}
            readOnly={true}
            studio={props.studio}
            minimap={true}
          />
        </div>
      </EditorContent>
    </Editor>
  );
}
