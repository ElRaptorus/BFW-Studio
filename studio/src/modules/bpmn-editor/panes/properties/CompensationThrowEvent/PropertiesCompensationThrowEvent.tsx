import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';
import { BpmnElementType } from '#modules/bpmn-editor/BpmnElementTypes';

import React from 'react';

import type { Suggestion } from '@elraptorus/bfw_studio_sdk';
import { PaneProperty } from '@elraptorus/bfw_studio_sdk';

import type BpmnDocumentModel from '../../../BpmnDocumentModel';
import {
  getBpmnSelectionForPropertiesPane,
  getKeyForPropertiesPane,
  shouldBeDisplayedForBpmnElementOfType,
} from '../../PropertiesPaneFunctions';

const COMPENSABLE_ACTIVITY_TYPES: ReadonlySet<string> = new Set([
  'bpmn:Task',
  'bpmn:UserTask',
  'bpmn:ManualTask',
  'bpmn:ServiceTask',
  'bpmn:ScriptTask',
  'bpmn:SendTask',
  'bpmn:ReceiveTask',
  'bpmn:BusinessRuleTask',
  'bpmn:CallActivity',
  'bpmn:SubProcess',
]);

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Compensation Target';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/compensation_intermediate_throw_event" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return (
    shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.CompensationEndEvent) ||
    shouldBeDisplayedForBpmnElementOfType(
      editorDocument,
      editorDocumentModel,
      BpmnElementType.CompensationIntermediateThrowEvent,
    )
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }
  return <PropertiesCompensationThrowEvent key={getKeyForPropertiesPane(selection)} {...props} />;
}

function PropertiesCompensationThrowEvent(props: PaneComponentProps): React.JSX.Element {
  const model = props.editorDocumentModel as BpmnDocumentModel;
  const element = model?.selection?.getOnlyElementOrNull();
  assertNotNull(element, 'Compensation Throw Event');
  const currentActivityRef = (element as any)?.compensationActivityRef;

  const onActivityRefChange = (newValue: any): void => {
    model.elements.setElementProperty(element.id, 'compensationActivityRef', newValue?.value ?? null);
  };

  const getActivitySuggestions = async (): Promise<Suggestion[]> => {
    try {
      const elementRegistry = model.modelerAdapter.getElementRegistry();
      if (!elementRegistry) {
        return [];
      }

      const activities = elementRegistry.filter(
        (el: any) => COMPENSABLE_ACTIVITY_TYPES.has(el.type) && el.businessObject?.isForCompensation !== true,
      );

      const suggestions: Suggestion[] = activities.map((activity: any) => ({
        label: activity.businessObject?.name || activity.id,
        sublabel: activity.id,
        value: activity.id,
      }));

      return suggestions;
    } catch {
      return [];
    }
  };

  return (
    <PaneBody key={`compensation_activity_ref_${currentActivityRef ?? 'none'}`}>
      <PaneProperty
        label="Activity"
        type="text-with-suggestions"
        htmlId="compensation-activity-ref-property"
        placeholder="Broadcast (all completed activities)"
        value={currentActivityRef}
        onCommit={onActivityRefChange}
        suggestions={getActivitySuggestions()}
        isClearable={true}
      />
    </PaneBody>
  );
}
