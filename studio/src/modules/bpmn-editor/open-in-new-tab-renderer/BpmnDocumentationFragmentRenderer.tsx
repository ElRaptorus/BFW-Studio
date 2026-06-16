import React, { useEffect, useRef, useState } from 'react';

import type { AbstractSubscription, EditorDocumentRendererProps } from '@evil/bifrost_fw_sdk';
import {
  Editor,
  EditorContent,
  EditorToolbar,
  EditorToolbarLeft,
  EditorToolbarText,
  MarkdownEditor,
  assertNotNull,
  parseOpenInNewTabUrl,
} from '@evil/bifrost_fw_sdk';
import type { MarkdownEditorAttributes } from '@evil/bifrost_fw_sdk';

import { EVENT_DATA_UPDATED } from '../../../../../studio-sdk/src/contracts/internal/EditorEvents';
import BpmnDocumentModel from '../BpmnDocumentModel';

export default function BpmnDocumentationFragmentRenderer(
  props: EditorDocumentRendererProps,
): React.JSX.Element | null {
  const bifrost = props.studio;
  const mdxRef = useRef<MarkdownEditorAttributes | null>(null);
  const bpmnDocumentModelRef = useRef<BpmnDocumentModel | null>(null);

  const parsedFragmentUri = parseOpenInNewTabUrl(props.editorDocument.uri);
  const parentUri = parsedFragmentUri.parentUri;
  const fragmentId = parsedFragmentUri.fragmentId;

  const parentEditorDocument = bifrost.editors.getEditorDocumentByUri(parentUri);
  assertNotNull(parentEditorDocument, 'parentEditorDocument');

  const [loading, setLoading] = useState(true);
  const [fragmentName, setFragmentName] = useState<string | null>(null);
  const [documentation, setDocumentation] = useState<string>('');

  function handleChange(value: string): void {
    const model = bpmnDocumentModelRef.current;
    if (model == null) {
      return;
    }
    model.elements.setElementProperty(fragmentId, 'documentation', value);
    model.selection.updateSelectionIfIsCurrentlySelected(fragmentId, fragmentId);
  }

  useEffect(() => {
    let subscriptionRef: AbstractSubscription | null = null;
    let mounted = true;
    const editorRef = mdxRef;

    function onParentDataUpdated(): void {
      if (!mounted) {
        return;
      }
      const model = bpmnDocumentModelRef.current;
      if (model == null) {
        return;
      }
      const element = model.elements.getById(fragmentId);
      setDocumentation(element?.documentation ?? '');
      setLoading(false);
    }

    bifrost.editors
      .getEditorDocumentModel<BpmnDocumentModel>(parentEditorDocument, BpmnDocumentModel)
      .then((model: BpmnDocumentModel) => {
        if (!mounted) {
          return;
        }
        bpmnDocumentModelRef.current = model;

        const element = model.elements.getById(fragmentId);
        setFragmentName(element?.name ?? null);

        model.onceInteractive(() => onParentDataUpdated());
        onParentDataUpdated();

        subscriptionRef = model.on(EVENT_DATA_UPDATED, () => onParentDataUpdated());
      });

    return () => {
      mounted = false;

      if (subscriptionRef != null) {
        subscriptionRef.dispose();
      }

      // Blur the editor to dismiss floating-UI popups before DOM teardown
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      const editor = editorRef.current;
      if (editor != null && bpmnDocumentModelRef.current != null) {
        try {
          const currentValue = editor.getMarkdown();
          if (currentValue != null) {
            bpmnDocumentModelRef.current.elements.setElementProperty(fragmentId, 'documentation', currentValue);
          }
        } catch {
          // MDXEditor DOM may already be torn down during unmount
        }
      }
    };
  }, [bifrost.editors, fragmentId, parentEditorDocument]);

  if (loading) {
    return null;
  }

  return (
    <Editor>
      <EditorToolbar>
        <EditorToolbarLeft>
          {parentEditorDocument && (
            <EditorToolbarText studio={bifrost}>
              Documentation for &quot;
              <a href="#" onClick={() => bifrost.editors.focusOrOpenEditorDocument(parentEditorDocument)}>
                {fragmentName ?? fragmentId}
              </a>
              &quot; ({fragmentId}) in{' '}
              <a href="#" onClick={() => bifrost.editors.focusOrOpenEditorDocument(parentEditorDocument)}>
                {parentEditorDocument.label}
              </a>
            </EditorToolbarText>
          )}
        </EditorToolbarLeft>
      </EditorToolbar>
      <EditorContent>
        <MarkdownEditor
          ref={mdxRef}
          studio={bifrost}
          data={documentation}
          onDataChanged={handleChange}
          toolbar="full"
          htmlAttributes={{ style: { height: '100%' } }}
        />
      </EditorContent>
    </Editor>
  );
}
