import type { EditorDocumentRendererProps } from '#bifrost/contracts/EditorTypes';
import { MultiLineCodeEditor } from '#components/MultiLineCodeEditor';
import { Editor } from '#components/editor/Editor';
import { EditorContent } from '#components/editor/EditorContent';
import { EditorToolbar } from '#components/editor/EditorToolbar';
import { EditorToolbarLeft } from '#components/editor/EditorToolbarLeft';
import { EditorToolbarText } from '#components/editor/EditorToolbarText';
import * as jsonComment from 'comment-json';

import React from 'react';

export default function DefaultSettingsRenderer(props: EditorDocumentRendererProps): React.JSX.Element {
  const settingsAsString = jsonComment.stringify(props.studio.settings.getDefaults(), null, 2);

  return (
    <Editor>
      <EditorToolbar>
        <EditorToolbarLeft>
          <EditorToolbarText studio={props.studio} label="The Studio's default settings cannot be changed" />
        </EditorToolbarLeft>
      </EditorToolbar>
      <EditorContent>
        <div className="settings" data-test-default-settings>
          <MultiLineCodeEditor
            initialValue={settingsAsString}
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
