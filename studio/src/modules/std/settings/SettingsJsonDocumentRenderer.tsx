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

import type { SettingsValidationResult } from '@elraptorus/bfw_studio_sdk';

import type ScopedSettingsDocumentModel from './ScopedSettingsDocumentModel';
import { parseSettingsScopeUri } from './ScopedSettingsDocumentModel';
import type UserSettingsDocumentModel from './UserSettingsDocumentModel';
import { EVENT_SETTINGS_RECEIVED_UPDATE, EVENT_SETTINGS_SAVE_VALIDATED } from './UserSettingsDocumentModel';
import { buildJsonSchema } from './validation/schemaToJsonSchema';

type SettingsJsonModel = UserSettingsDocumentModel | ScopedSettingsDocumentModel;

function formatValidationResult(result: SettingsValidationResult): string {
  return result.errors.map((error) => (error.key === '' ? error.message : `${error.key}: ${error.message}`)).join('; ');
}

export default function SettingsJsonDocumentRenderer(props: EditorDocumentRendererProps): React.JSX.Element {
  const studio = props.studio as Bifrost;
  const [model, setModel] = useState<SettingsJsonModel | null>(null);
  const scopeTarget = parseSettingsScopeUri(props.editorDocument.uri);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [jsonSchema, setJsonSchema] = useState(() => buildJsonSchema(studio.settings.getSchemas()));
  const editorRef = useRef<MultiLineCodeEditor | null>(null);
  const modelRef = useRef<SettingsJsonModel | null>(null);
  const subscriptionsRef = useRef<AbstractSubscription[]>([]);

  useEffect(() => {
    const sub = studio.settings.on(EVENT_SETTINGS_SCHEMA_REGISTERED, () => {
      const nextSchema = modelRef.current?.getJsonSchema() ?? buildJsonSchema(studio.settings.getSchemas());
      setJsonSchema(nextSchema);
      editorRef.current?.updateJsonSchema(nextSchema);
    });
    return () => sub.dispose();
  }, [studio]);

  useEffect(() => {
    let mounted = true;

    async function initialize(): Promise<void> {
      const documentModel = await props.studio.editors.getEditorDocumentModel<SettingsJsonModel>(props.editorDocument);

      if (!mounted) {
        return;
      }

      modelRef.current = documentModel;
      setModel(documentModel);
      const nextSchema = documentModel.getJsonSchema();
      setJsonSchema(nextSchema);
      editorRef.current?.updateJsonSchema(nextSchema);

      subscriptionsRef.current = [
        documentModel.on(EVENT_SETTINGS_RECEIVED_UPDATE, () => {
          setValidationMessage(null);
        }),
        documentModel.on(EVENT_SETTINGS_SAVE_VALIDATED, (result: SettingsValidationResult) => {
          setValidationMessage(result.valid ? null : formatValidationResult(result));
        }),
      ];

      editorRef.current?.focus();
    }

    initialize();

    return () => {
      mounted = false;
      modelRef.current = null;
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
    model?.updateSettingsAsString(editorRef.current?.getCurrentValue() ?? '');
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
            command="std.settings.openSettingsAtScope"
            commandArgs={[scopeTarget ?? { scope: 'user' }]}
          />
          {scopeTarget == null && (
            <EditorToolbarButton
              studio={props.studio}
              icon="settings/editor-toolbar/reset"
              label="Reset settings"
              tooltip="Reset settings"
              command="std.settings.resetToDefault"
            />
          )}
        </EditorToolbarRight>
      </EditorToolbar>
      <EditorContent>
        <div className="settings" data-test-settings>
          <MultiLineCodeEditor
            key={model ? 'loaded' : 'loading'}
            initialValue={model?.getSettingsAsString() ?? ''}
            language="json"
            jsonSchema={jsonSchema}
            lineNumbers={true}
            readOnly={false}
            studio={props.studio}
            onChange={onValueChanged}
            ref={editorRef}
            minimap={true}
          />
        </div>
      </EditorContent>
    </Editor>
  );
}
