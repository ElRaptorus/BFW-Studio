import type { Bifrost } from '#bifrost/Bifrost';
import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import { FeelSimulatorEditor } from '#components/feel-simulator';
import type { FlowNodeInstance } from '@elraptorus/daemonengine_sdk';
import type { FlowNode as BpmnFlowNode } from '@elraptorus/daemonengine_sdk';

import React, { useMemo } from 'react';

import type { FeelEditorVariable } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import type { FlowNode } from '../../libs/SelectableElement';

export type RuntimeExpressionRunnerProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Bifrost;
};

export function RuntimeExpressionRunner(props: RuntimeExpressionRunnerProps): React.JSX.Element {
  const selectedElements = props.model.selectedElements;
  if (
    selectedElements.length != 1 ||
    selectedElements[0].type != 'FlowNode' ||
    selectedElements[0].flowNodeInstances.length === 0 ||
    !props.model.selectedFlowNodeInstance
  ) {
    return <div className="pane__content">Select a specific Flow Node Instance to get started.</div>;
  }

  const flowNode = selectedElements[0] as FlowNode;
  const selectedFlowNodeInstance = props.model.getSelectedFlowNodeInstanceByFlowNode(flowNode);

  return (
    <RuntimeFeelExpressionRunner
      key={selectedFlowNodeInstance.id}
      model={props.model}
      studio={props.studio}
      flowNode={flowNode}
      selectedFlowNodeInstance={selectedFlowNodeInstance}
    />
  );
}

function buildFeelContext(
  model: EngineBpmnDebuggerEditorDocumentModel,
  selectedFlowNodeInstance: FlowNodeInstance,
  flowNode: BpmnFlowNode | undefined,
): Record<string, unknown> {
  assertNotNull(model.processInstance, 'model.processInstance');

  const processInstance = model.processInstance;

  return {
    token: selectedFlowNodeInstance.inputToken ?? {},
    this: flowNode ? { id: flowNode.id, name: flowNode.name, type: flowNode.type } : {},
    context: processInstance.startedWithContext ?? {},
    process: {
      id: processInstance.processModelId,
      name: model.processModel?.name ?? processInstance.processModelId,
      version: processInstance.version ?? '',
    },
    processInstance: {
      id: processInstance.id,
      businessKey: processInstance.businessKey ?? null,
      startedAt: processInstance.startedAt ?? null,
      startedBy: processInstance.startedBy ?? null,
      parentId: processInstance.parentProcessInstanceId ?? null,
    },
    identity: processInstance.startedBy ?? {},
    dataObjects: model.getDataObjectValuesAvailableToFlowNodeInstance(selectedFlowNodeInstance),
    loop: null,
  };
}

function buildFeelVariableDefinitions(feelContext: Record<string, unknown>): FeelEditorVariable[] {
  const variables: FeelEditorVariable[] = [];

  for (const [key, value] of Object.entries(feelContext)) {
    if (value == null) {
      continue;
    }

    const variable: FeelEditorVariable = { name: key, entries: [] };

    if (typeof value === 'object' && !Array.isArray(value)) {
      variable.entries = Object.keys(value as Record<string, unknown>).map((subKey) => ({
        name: subKey,
        entries: [],
      }));
    }

    variables.push(variable);
  }

  return variables;
}

type RuntimeFeelExpressionRunnerProps = {
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Bifrost;
  flowNode: FlowNode;
  selectedFlowNodeInstance: FlowNodeInstance;
};

function RuntimeFeelExpressionRunner(props: RuntimeFeelExpressionRunnerProps): React.JSX.Element {
  const { model, studio, flowNode, selectedFlowNodeInstance } = props;

  const initialContext = useMemo(
    () => buildFeelContext(model, selectedFlowNodeInstance, flowNode.flowNodeModel),
    [model, selectedFlowNodeInstance, flowNode.flowNodeModel],
  );

  const variables = useMemo(() => buildFeelVariableDefinitions(initialContext), [initialContext]);

  return (
    <FeelSimulatorEditor
      studio={studio}
      initialExpression=""
      variables={variables}
      onChange={() => {}}
      layout="MultiLine"
      initialContext={initialContext}
    />
  );
}
