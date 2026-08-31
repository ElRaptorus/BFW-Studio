import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { MarkdownEditor } from '#components/MarkdownEditor';
import { Pane } from '#components/panes/Pane';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';

import React, { useEffect, useRef } from 'react';

import type DmnDocumentModel from '../../../DmnDocumentModel';
import { DMN_DOCUMENT_TYPE } from '../../../index';

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
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="dmn/properties/documentation" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  if (editorDocument?.documentType !== DMN_DOCUMENT_TYPE) {
    return false;
  }

  const model = editorDocumentModel as DmnDocumentModel | null;
  if (model == null) {
    return false;
  }

  const activeViewType = model.getActiveViewType?.();
  if (activeViewType !== 'drd') {
    return false;
  }

  const selectedElements = model.selection?.getElements();
  return selectedElements?.length === 1;
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const containerRef = useRef<HTMLDivElement>(null);
  const dmnDocumentModel = props.editorDocumentModel as DmnDocumentModel | null;

  useEffect(() => {
    const container = containerRef.current;
    return () => {
      if (container?.contains(document.activeElement) && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    };
  }, []);

  if (dmnDocumentModel == null) {
    return null;
  }

  const element = dmnDocumentModel.selection.getOnlyElementOrNull();
  if (element == null) {
    return null;
  }

  const onDocumentationChanged = (value: string): void => {
    dmnDocumentModel.elements.setElementProperty(element.id, 'description', value);
  };

  const businessObject = dmnDocumentModel.elements.getBusinessObject(element.id);
  const currentDescription = businessObject?.description ?? '';

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <MarkdownEditor
        key={`${element.type}__${element.id}`}
        studio={props.studio}
        data={currentDescription}
        onDataChanged={onDocumentationChanged}
        toolbar="compact"
        htmlAttributes={{ style: { height: '100%' } }}
      />
    </div>
  );
}
