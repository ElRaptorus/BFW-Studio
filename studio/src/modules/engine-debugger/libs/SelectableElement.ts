import type { DataObjectValue, FlowNodeInstance } from '@elraptorus/daemonengine_sdk';
import type {
  FlowNode as BpmnFlowNode,
  BpmnProcess,
  SequenceFlow as BpmnSequenceFlow,
  DataAssociation,
  DataObjectReference,
} from '@elraptorus/daemonengine_sdk';

import type { BpmnDiagramShape, BpmnProcessRef } from '../types/BpmnDiagramShape';
import type { DebuggerProcessInstance } from '../types/DebuggerTypes';
import {
  findDataInputAssociationTarget,
  findDataOutputAssociationSource,
  getAllDataObjectReferences,
  getAllSequenceFlows,
  getFlowNodeById,
} from './BpmnProcessHelpers';

export type GenericElement = {
  type: 'Generic';
  id: string;
  name?: string;
  shapeType: string;
  documentation?: string;
};

export type DataObject = {
  type: 'DataObject';
  id: string;
  name?: string;
  shapeType: string;
  dataObjectModel: DataObjectReference | undefined;
  dataObjectValues: DataObjectValue[];
  documentation?: string;
};

export type DataInputAssociation = {
  type: 'DataInputAssociation';
  id: string;
  name?: string;
  shapeType: string;
  associationModel: DataAssociation | undefined;
  source: DataObjectReference | undefined;
  target: BpmnFlowNode | undefined;
  documentation?: string;
};

export type DataOutputAssociation = {
  type: 'DataOutputAssociation';
  id: string;
  name?: string;
  shapeType: string;
  associationModel: DataAssociation | undefined;
  source: BpmnFlowNode | undefined;
  target: DataObjectReference | undefined;
  documentation?: string;
};

export type ExecutableFlowNode = {
  type: 'FlowNode';
  id: string;
  name?: string;
  shapeType: string;
  flowNodeModel: BpmnFlowNode | undefined;
  flowNodeInstances: FlowNodeInstance[];
  documentation?: string;
};

/** @deprecated Use {@link ExecutableFlowNode} — kept as alias for gradual migration. */
export type FlowNode = ExecutableFlowNode;

export type Participant = {
  type: 'Participant';
  id: string;
  name?: string;
  shapeType: string;
  processModelId: string | undefined;
  processModelName: string | undefined;
  documentation?: string;
};

export type SequenceFlow = {
  type: 'SequenceFlow';
  id: string;
  name?: string;
  shapeType: string;
  isDefaultFlow: boolean;
  sequenceFlowModel: BpmnSequenceFlow | undefined;
  sourceFlowNode: BpmnFlowNode | undefined;
  targetFlowNode: BpmnFlowNode | undefined;
  documentation?: string;
};

export type SelectableElement =
  | GenericElement
  | DataObject
  | DataInputAssociation
  | DataOutputAssociation
  | FlowNode
  | Participant
  | SequenceFlow;

const mapGenericElement = (shape: BpmnDiagramShape): GenericElement => {
  return {
    type: 'Generic',
    id: shape.id,
    name: shape.businessObject.name,
    shapeType: shape.type,
    documentation: shape.businessObject.documentation ? (shape.businessObject.documentation[0].text ?? '') : '',
  };
};

const mapDataObject = (
  shape: BpmnDiagramShape,
  processModel: BpmnProcess,
  dataObjectValues: DataObjectValue[],
): DataObject => {
  const dataObjectModel = getAllDataObjectReferences(processModel).find((dataObject) => dataObject.id === shape.id);

  return {
    type: 'DataObject',
    id: shape.id,
    name: shape.businessObject.name,
    shapeType: shape.type,
    dataObjectModel,
    dataObjectValues: dataObjectValues?.filter((entry) => entry.dataObjectId === shape.id) ?? [],
    documentation: dataObjectModel?.name ?? '',
  };
};

const mapDataInputAssociation = (shape: BpmnDiagramShape, processModel: BpmnProcess): DataInputAssociation => {
  const match = findDataInputAssociationTarget(processModel, shape.id);
  const association = match?.association;
  const targetFlowNode = match?.target;

  let source = processModel.dataObjectReferences.find((dataObject) => dataObject.id === association?.sourceRef);
  if (!source) {
    source = processModel.dataStoreReferences.find((dataStore) => dataStore.id === association?.sourceRef) as
      | DataObjectReference
      | undefined;
  }

  return {
    type: 'DataInputAssociation',
    id: shape.id,
    name: shape.businessObject.name,
    shapeType: shape.type,
    associationModel: association,
    source,
    target: targetFlowNode,
    documentation: '',
  };
};

const mapDataOutputAssociation = (shape: BpmnDiagramShape, processModel: BpmnProcess): DataOutputAssociation => {
  const match = findDataOutputAssociationSource(processModel, shape.id);
  const association = match?.association;
  const sourceFlowNode = match?.source;

  let target = processModel.dataObjectReferences.find((dataObject) => dataObject.id === association?.targetRef);
  if (!target) {
    target = processModel.dataStoreReferences.find((dataStore) => dataStore.id === association?.targetRef) as
      | DataObjectReference
      | undefined;
  }

  return {
    type: 'DataOutputAssociation',
    id: shape.id,
    name: shape.businessObject.name,
    shapeType: shape.type,
    associationModel: association,
    source: sourceFlowNode,
    target,
    documentation: '',
  };
};

const mapFlowNode = (
  shape: BpmnDiagramShape,
  processModel: BpmnProcess,
  flowNodeInstance?: FlowNodeInstance,
): FlowNode => {
  const flowNode = getFlowNodeById(processModel, flowNodeInstance?.flowNodeId ?? shape.id);

  let documentation = '';
  if (flowNode?.documentation) {
    documentation = flowNode.documentation;
  } else if (shape.businessObject.documentation) {
    documentation = shape.businessObject.documentation[0].text ?? '';
  }

  return {
    type: 'FlowNode',
    id: shape.id,
    name: shape.businessObject.name,
    shapeType: shape.type,
    flowNodeModel: flowNode,
    flowNodeInstances: flowNodeInstance ? [flowNodeInstance] : [],
    documentation,
  };
};

const mapParticipant = (shape: BpmnDiagramShape, processInstance: DebuggerProcessInstance): Participant => {
  const processRef = shape.businessObject.processRef as BpmnProcessRef | undefined;

  return {
    id: shape.id,
    name: shape.businessObject.name,
    shapeType: shape.type,
    type: 'Participant',
    processModelId: processRef?.id,
    processModelName: processRef?.name,
    documentation: shape.businessObject.documentation ? (shape.businessObject.documentation[0].text ?? '') : '',
  };
};

const mapSequenceFlow = (shape: BpmnDiagramShape, processModel: BpmnProcess): SequenceFlow => {
  const sequenceFlowModel = getAllSequenceFlows(processModel).find((flow) => flow.id === shape.id);

  return {
    type: 'SequenceFlow',
    id: shape.id,
    name: shape.businessObject.name,
    shapeType: shape.type,
    isDefaultFlow: sequenceFlowModel?.isDefault ?? false,
    sequenceFlowModel,
    sourceFlowNode: sequenceFlowModel ? getFlowNodeById(processModel, sequenceFlowModel.sourceRef) : undefined,
    targetFlowNode: sequenceFlowModel ? getFlowNodeById(processModel, sequenceFlowModel.targetRef) : undefined,
    documentation: '',
  };
};

export const ShapeMappers = {
  GenericElement: mapGenericElement,
  DataObject: mapDataObject,
  DataInputAssociation: mapDataInputAssociation,
  DataOutputAssociation: mapDataOutputAssociation,
  FlowNode: mapFlowNode,
  Participant: mapParticipant,
  SequenceFlow: mapSequenceFlow,
};
