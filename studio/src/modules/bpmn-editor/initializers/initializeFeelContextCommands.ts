import type { Bifrost } from '#bifrost/Bifrost';
import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { BpmnElement } from '#modules/bpmn-editor/BpmnElementTypes';
import { BpmnElementType } from '#modules/bpmn-editor/BpmnElementTypes';

import type { FeelEditorVariable } from '@evil/bifrost_fw_sdk';

import type BpmnDocumentModel from '../BpmnDocumentModel';
import { BPMN_DOCUMENT_TYPE } from '../index';

const LOOP_VARIABLE: FeelEditorVariable = {
  name: 'loop',
  detail: 'Loop context (multi-instance / standard loop)',
  type: 'variable',
  entries: [
    { name: 'index', detail: 'number (0-based iteration index)' },
    { name: 'item', detail: 'any (current collection element; null for standard loops)' },
    { name: 'total', detail: 'number | null (collection length; null for standard loops)' },
    { name: 'completed', detail: 'number (iterations completed so far)' },
    { name: 'results', detail: 'list (results from completed iterations)', isList: true },
  ],
};

function buildCoreFeelVariables(): FeelEditorVariable[] {
  return [
    {
      name: 'token',
      detail: 'Current flow node input payload',
      type: 'variable',
      entries: [],
    },
    {
      name: 'this',
      detail: 'Current flow node metadata',
      type: 'variable',
      entries: [
        { name: 'id', detail: 'string' },
        { name: 'name', detail: 'string' },
        { name: 'type', detail: 'string' },
      ],
    },
    {
      name: 'context',
      detail: 'Initial input values (process variables)',
      type: 'variable',
      entries: [],
    },
    {
      name: 'process',
      detail: 'Process model information',
      type: 'variable',
      entries: [
        { name: 'id', detail: 'string' },
        { name: 'name', detail: 'string' },
        { name: 'version', detail: 'string' },
      ],
    },
    {
      name: 'processInstance',
      detail: 'Current process instance',
      type: 'variable',
      entries: [
        { name: 'id', detail: 'string' },
        { name: 'businessKey', detail: 'string (optional)' },
        { name: 'startedAt', detail: 'date and time' },
        { name: 'startedBy', detail: 'string' },
        { name: 'parentId', detail: 'string (optional)' },
      ],
    },
    {
      name: 'identity',
      detail: 'Current user identity (JWT)',
      type: 'variable',
      entries: [
        { name: 'id', detail: 'string' },
        { name: 'roles', detail: 'list of string', isList: true },
        { name: 'groups', detail: 'list of string', isList: true },
        { name: 'claims', detail: 'context' },
      ],
    },
  ];
}

function buildDataObjectVariables(allElements: BpmnElement[]): FeelEditorVariable {
  const dataObjectRefs = allElements.filter((element) => element.type === BpmnElementType.DataObject);

  return {
    name: 'dataObjects',
    detail: 'BPMN Data Objects',
    type: 'variable',
    entries: dataObjectRefs.map((ref) => ({
      name: ref.name || ref.id,
      detail: 'Data Object',
    })),
  };
}

function elementHasLoopCharacteristics(element: BpmnElement | null | undefined): boolean {
  if (element == null) {
    return false;
  }
  const loopConfig = (element as any).loopConfig;
  if (loopConfig == null) {
    return false;
  }
  return loopConfig.kind === 'multiInstance' || loopConfig.kind === 'standard';
}

export function initializeFeelContextCommands(bifrost: Bifrost): void {
  bifrost.commands.register(
    'bpmn.feel.getExpressionContext',
    async (editorDocument?: EditorDocument, selectedElementId?: string): Promise<FeelEditorVariable[]> => {
      const coreVariables = buildCoreFeelVariables();

      if (editorDocument?.documentType === BPMN_DOCUMENT_TYPE) {
        const bpmnDocumentModel = await bifrost.editors.getEditorDocumentModel<BpmnDocumentModel>(editorDocument);
        const allBpmnElements = bpmnDocumentModel.elements.getVisibleElements();
        assertNotNull(allBpmnElements, 'allBpmnElements');

        const dataObjectVariable = buildDataObjectVariables(allBpmnElements);

        const selectedElement = selectedElementId
          ? bpmnDocumentModel.elements.getById(selectedElementId)
          : bpmnDocumentModel.selection.getOnlyElementOrNull();

        const includeLoop = elementHasLoopCharacteristics(selectedElement);
        const variables = [...coreVariables, dataObjectVariable];
        if (includeLoop) {
          variables.push(LOOP_VARIABLE);
        }

        return variables;
      }

      return [...coreVariables, LOOP_VARIABLE];
    },
  );
}
