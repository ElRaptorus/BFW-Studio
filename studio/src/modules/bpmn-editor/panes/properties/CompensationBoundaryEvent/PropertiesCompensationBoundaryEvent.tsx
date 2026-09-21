import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';
import { BpmnElementType } from '#modules/bpmn-editor/BpmnElementTypes';

import React from 'react';

import { PaneProperty } from '@elraptorus/bfw_studio_sdk';

import type BpmnDocumentModel from '../../../BpmnDocumentModel';
import {
  getBpmnSelectionForPropertiesPane,
  getKeyForPropertiesPane,
  shouldBeDisplayedForBpmnElementOfType,
} from '../../PropertiesPaneFunctions';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Compensation Boundary Event';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/compensation_boundary_event" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return shouldBeDisplayedForBpmnElementOfType(
    editorDocument,
    editorDocumentModel,
    BpmnElementType.CompensationBoundaryEvent,
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }
  return <PropertiesCompensationBoundaryEvent key={getKeyForPropertiesPane(selection)} {...props} />;
}

function PropertiesCompensationBoundaryEvent(props: PaneComponentProps): React.JSX.Element {
  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;
  const element = bpmnDocumentModel?.selection?.getOnlyElementOrNull();

  const handlerInfo = resolveCompensationHandler(bpmnDocumentModel, element?.id);

  return (
    <PaneBody>
      <PaneProperty type="text" label="Handler Activity" disabled={true} value={handlerInfo.handlerName} />
      <PaneProperty
        type="text"
        label="Is For Compensation"
        disabled={true}
        value={handlerInfo.isForCompensation ? 'Yes' : 'No'}
      />
      {!handlerInfo.hasHandler && (
        <p className="text-muted small mt-2">
          No compensation handler is linked. Connect this boundary event to an activity via a{' '}
          <code>bpmn:Association</code> and mark the handler with <code>isForCompensation</code>.
        </p>
      )}
    </PaneBody>
  );
}

function resolveCompensationHandler(
  model: BpmnDocumentModel | null,
  boundaryEventId: string | undefined,
): { handlerName: string; isForCompensation: boolean; hasHandler: boolean } {
  if (!model || !boundaryEventId) {
    return { handlerName: 'N/A', isForCompensation: false, hasHandler: false };
  }

  try {
    const elementRegistry = model.modelerAdapter.getElementRegistry();
    if (!elementRegistry) {
      return { handlerName: 'N/A', isForCompensation: false, hasHandler: false };
    }

    const associations = elementRegistry.filter((el: any) => el.type === 'bpmn:Association');
    for (const assoc of associations) {
      const sourceRef = assoc.businessObject?.sourceRef;
      const targetRef = assoc.businessObject?.targetRef;
      if (sourceRef?.id === boundaryEventId && targetRef) {
        const handlerName = targetRef.name || targetRef.id || 'Unknown';
        const isForCompensation = targetRef.isForCompensation === true;
        return { handlerName, isForCompensation, hasHandler: true };
      }
    }
  } catch {
    // Modeler may not be ready
  }

  return { handlerName: 'N/A', isForCompensation: false, hasHandler: false };
}
