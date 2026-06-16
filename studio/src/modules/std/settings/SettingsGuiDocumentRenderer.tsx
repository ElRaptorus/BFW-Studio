import React from 'react';

import type { EditorDocumentRendererProps } from '@evil/bifrost_fw_sdk';
import {
  Editor,
  EditorContent,
  EditorToolbar,
  EditorToolbarButton,
  EditorToolbarLeft,
  EditorToolbarRight,
  EditorToolbarText,
} from '@evil/bifrost_fw_sdk';

import { SettingsGui } from './gui/SettingsGui';

export default function SettingsGuiDocumentRenderer(props: EditorDocumentRendererProps): React.JSX.Element {
  const onOpenJsonEditor = (): void => {
    props.studio.editors.focusOrOpenEditorDocument('about:settings-json', 'Settings (JSON)');
  };

  return (
    <Editor>
      <EditorToolbar>
        <EditorToolbarLeft>
          <EditorToolbarText
            studio={props.studio}
            label={<span className="settings__hint--default">Changes are applied immediately.</span>}
          />
        </EditorToolbarLeft>
        <EditorToolbarRight>
          <EditorToolbarButton
            studio={props.studio}
            icon="settings/editor-toolbar/open-json"
            label="Open JSON Editor"
            tooltip="Open JSON Editor"
            command="std.settings.openUserSettingsJson"
          />
          <EditorToolbarButton
            studio={props.studio}
            icon="settings/editor-toolbar/reset"
            label="Reset settings"
            tooltip="Reset settings"
            command="std.settings.resetToDefault"
          />
        </EditorToolbarRight>
      </EditorToolbar>
      <EditorContent>
        <div className="settings" data-test-settings>
          <SettingsGui studio={props.studio} onOpenJsonEditor={onOpenJsonEditor} />
        </div>
      </EditorContent>
    </Editor>
  );
}
