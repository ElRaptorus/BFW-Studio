import type { Bifrost } from '#bifrost/Bifrost';
import type { AbstractSubscription } from '#bifrost/common/AbstractEmitter';
import type { EditorDocumentRendererProps } from '#bifrost/contracts/EditorTypes';
import { EVENT_SETTINGS_SCHEMA_REGISTERED } from '#bifrost/contracts/internal/SettingsEvents';
import { MultiLineCodeEditor } from '#components/MultiLineCodeEditor';
import { Editor } from '#components/editor/Editor';
import { EditorContent } from '#components/editor/EditorContent';
import { EditorToolbar } from '#components/editor/EditorToolbar';
import { EditorToolbarButton } from '#components/editor/EditorToolbarButton';
import { EditorToolbarLeft } from '#components/editor/EditorToolbarLeft';
import { EditorToolbarRight } from '#components/editor/EditorToolbarRight';
import { EditorToolbarText } from '#components/editor/EditorToolbarText';

import React, { useEffect, useRef, useState } from 'react';

import type UserSettingsDocumentModel from './UserSettingsDocumentModel';
import { EVENT_SETTINGS_RECEIVED_UPDATE } from './UserSettingsDocumentModel';
import { configureMonacoJsonValidation } from './configureMonacoJsonValidation';

export default function SettingsJsonDocumentRenderer(props: EditorDocumentRendererProps): React.JSX.Element {
  const studio = props.studio as Bifrost;
  const [model, setModel] = useState<UserSettingsDocumentModel | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const monacoRef = useRef<MultiLineCodeEditor | null>(null);
  const subscriptionsRef = useRef<AbstractSubscription[]>([]);

  useEffect(() => {
    configureMonacoJsonValidation(studio);

    const sub = studio.settings.on(EVENT_SETTINGS_SCHEMA_REGISTERED, () => {
      configureMonacoJsonValidation(studio);
    });
    return () => sub.dispose();
  }, [studio]);

  useEffect(() => {
    let mounted = true;

    async function initialize(): Promise<void> {
      const documentModel = await props.studio.editors.getEditorDocumentModel<UserSettingsDocumentModel>(
        props.editorDocument,
      );

      if (!mounted) {
        return;
      }

      setModel(documentModel);

      subscriptionsRef.current = [
        documentModel.on(EVENT_SETTINGS_RECEIVED_UPDATE, () => {
          setValidationMessage(null);
        }),
      ];

      monacoRef.current?.focus();
    }

    initialize();

    return () => {
      mounted = false;
      subscriptionsRef.current.forEach((subscription: AbstractSubscription) => subscription.dispose());
    };
  }, [props.studio, props.editorDocument]);

  const hint = (() => {
    if (validationMessage != null) {
      return <span className="settings__hint--error">{validationMessage}</span>;
    }
    if (model != null && model.isInvalidJSON()) {
      return <span className="settings__hint--error">Please provide valid JSON.</span>;
    }
    return <span className="settings__hint--default">Settings will take effect once you save the document.</span>;
  })();

  const onValueChanged = (): void => {
    model?.updateSettingsAsString(monacoRef.current?.getCurrentValue() ?? '');
    setValidationMessage(null);
  };

  return (
    <Editor>
      <EditorToolbar>
        <EditorToolbarLeft>
          <EditorToolbarText studio={props.studio} label={hint} />
        </EditorToolbarLeft>
        <EditorToolbarRight>
          <EditorToolbarButton
            studio={props.studio}
            icon="settings/editor-toolbar/open-gui"
            label="Open GUI Editor"
            tooltip="Open GUI Editor"
            command="std.settings.openUserSettings"
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
          <MultiLineCodeEditor
            key={model ? 'loaded' : 'loading'}
            initialValue={model?.getSettingsAsString() ?? ''}
            language="json"
            modelPath="about:user-settings.json"
            lineNumbers={true}
            readOnly={false}
            studio={props.studio}
            onChange={onValueChanged}
            ref={monacoRef}
            minimap={true}
          />
        </div>
      </EditorContent>
    </Editor>
  );
}
