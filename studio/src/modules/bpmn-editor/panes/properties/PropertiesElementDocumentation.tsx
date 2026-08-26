import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { MarkdownEditor } from '#components/MarkdownEditor';
import { OpenInNewTabButton } from '#components/OpenInNewTabButton';
import { Pane } from '#components/panes/Pane';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';

import React, { useEffect, useRef } from 'react';

import type BpmnDocumentModel from '../../BpmnDocumentModel';
import { BPMN_DOCUMENT_TYPE } from '../../index';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Documentation';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const bpmnDocumentModel = props.editorDocumentModel as BpmnDocumentModel | null;
  const element = bpmnDocumentModel?.selection?.getOnlyElementOrNull();

  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        {element != null && (
          <OpenInNewTabButton
            studio={props.studio}
            type="bpmn.docs"
            parentUri={props.editorDocument.uri}
            fragmentId={element.id}
            dataTest="documentation-open-in-new-tab"
          />
        )}
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/documentation" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  if (editorDocument?.documentType !== BPMN_DOCUMENT_TYPE) {
    return false;
  }

  const selectedElements = (editorDocumentModel as BpmnDocumentModel)?.selection?.getElements();
  return selectedElements?.length === 1;
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const containerRef = useRef<HTMLDivElement>(null);
  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;
  assertNotNull(bpmnDocumentModel, 'bpmnDocumentModel');

  const element = bpmnDocumentModel.selection.getOnlyElementOrNull();
  assertNotNull(element, 'element');

  useEffect(() => {
    const container = containerRef.current;
    return () => {
      if (container?.contains(document.activeElement) && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    };
  }, []);

  const onDocumentationChanged = (value: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'documentation', value);
  };

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <MarkdownEditor
        key={`${element.type}__${element.id}__${element.name}`}
        studio={props.studio}
        data={element.documentation ?? ''}
        onDataChanged={onDocumentationChanged}
        toolbar="compact"
        htmlAttributes={{ style: { height: '100%' } }}
      />
    </div>
  );
}
