import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { FeelExpressionHint } from '#components/FeelExpressionHint';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';
import { BpmnElementType } from '#modules/bpmn-editor/BpmnElementTypes';

import React, { useEffect, useState } from 'react';

import type { FeelEditorVariable } from '@elraptorus/bfw_studio_sdk';
import { FeelEditor } from '@elraptorus/bfw_studio_sdk';

import type BpmnDocumentModel from '../../../BpmnDocumentModel';
import { BPMN_DOCUMENT_TYPE } from '../../../index';
import { getBpmnSelectionForPropertiesPane, getKeyForPropertiesPane } from '../../PropertiesPaneFunctions';

const SEQUENCE_FLOW_TYPES: Set<string> = new Set([
  BpmnElementType.DefaultFlow,
  BpmnElementType.ConditionalFlow,
  BpmnElementType.SequenceFlow,
]);

// FEEL bindings the engine injects on top of the standard context while evaluating a
// Complex Join's activation condition. Surfaced as autocomplete entries so the editor matches
// what the engine actually provides at runtime.
const COMPLEX_JOIN_FEEL_VARIABLES: FeelEditorVariable[] = [
  {
    name: 'activatedCount',
    type: 'variable',
    detail: 'number',
    info: 'Number of incoming branches that have delivered a token to this join so far.',
  },
  {
    name: 'incomingCount',
    type: 'variable',
    detail: 'number',
    info: 'Total number of incoming sequence flows into this Complex Join.',
  },
];

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Activation Condition';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  if (editorDocument?.documentType !== BPMN_DOCUMENT_TYPE) {
    return false;
  }

  const bpmnModel = editorDocumentModel as BpmnDocumentModel;
  const selectedElements = bpmnModel?.selection?.getElements();
  if (selectedElements?.length !== 1) {
    return false;
  }

  const element = selectedElements[0];
  if (element?.type !== BpmnElementType.ComplexGateway) {
    return false;
  }

  // The activation condition only governs a Complex Join (or the join side of a mixed gateway),
  // which the engine classifies by having more than one incoming sequence flow.
  const incomingFlows = element.incomingFlows.filter((flow) => SEQUENCE_FLOW_TYPES.has(flow.type));
  const outgoingFlows = element.outgoingFlows.filter((flow) => SEQUENCE_FLOW_TYPES.has(flow.type));
  const isJoin = incomingFlows.length > 1 && outgoingFlows.length <= 1;
  const isMixed = incomingFlows.length > 1 && outgoingFlows.length > 1;

  return isJoin || isMixed;
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <FeelExpressionHint studio={props.studio} />
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/complex_gateway" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }
  return <PropertiesComplexGatewayActivationCondition key={getKeyForPropertiesPane(selection)} {...props} />;
}

function PropertiesComplexGatewayActivationCondition(props: PaneComponentProps): React.JSX.Element {
  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;
  assertNotNull(bpmnDocumentModel, 'bpmnDocumentModel');

  const element = bpmnDocumentModel.selection.getOnlyElementOrNull();
  assertNotNull(element, 'element');

  const activationCondition =
    (bpmnDocumentModel.elements.getElementPropertyValue(element.id, 'activationCondition') as string | undefined) ?? '';

  const onChange = (newValue: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'activationCondition', newValue);
  };

  const [feelVariables, setFeelVariables] = useState<FeelEditorVariable[]>(COMPLEX_JOIN_FEEL_VARIABLES);
  const { editorDocument } = props;
  const { commands } = props.studio;
  useEffect(() => {
    commands
      .executeCommand<Promise<FeelEditorVariable[]>>('bpmn.feel.getExpressionContext', [editorDocument])
      .then((variables) => setFeelVariables([...COMPLEX_JOIN_FEEL_VARIABLES, ...variables]));
  }, [editorDocument, commands]);

  return (
    <PaneBody>
      <div className="form-group">
        <label>Activation Condition</label>
        <FeelEditor
          size="tall"
          fontSize={12}
          initialValue={activationCondition}
          onChange={(value: string) => onChange(value)}
          variables={feelVariables}
          htmlAttributes={{ 'data-test--complex-gateway-activation-condition': true }}
        />
      </div>
    </PaneBody>
  );
}
