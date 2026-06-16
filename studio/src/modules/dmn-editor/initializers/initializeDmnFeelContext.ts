import type { Bifrost } from '#bifrost/Bifrost';

import type { EditorDocument, FeelEditorVariable } from '@evil/bifrost_fw_sdk';

import type DmnDocumentModel from '../DmnDocumentModel';
import { DMN_DOCUMENT_TYPE } from '../index';

export function initializeDmnFeelContext(bifrost: Bifrost): void {
  bifrost.commands.register(
    'dmn.feel.getExpressionContext',
    async (editorDocument?: EditorDocument): Promise<FeelEditorVariable[]> => {
      return buildDmnFeelVariables(bifrost, editorDocument);
    },
  );
}

async function buildDmnFeelVariables(bifrost: Bifrost, editorDocument?: EditorDocument): Promise<FeelEditorVariable[]> {
  const variables: FeelEditorVariable[] = [];

  if (editorDocument?.documentType !== DMN_DOCUMENT_TYPE) {
    return variables;
  }

  const model = await bifrost.editors.getEditorDocumentModel<DmnDocumentModel>(editorDocument);
  if (!model) {
    return variables;
  }

  const definitions = model.elements.getDefinitions();
  if (!definitions) {
    return variables;
  }

  const drgElements: any[] = definitions.drgElement ?? [];

  for (const element of drgElements) {
    if (element.$type === 'dmn:InputData') {
      const variable = element.variable;
      variables.push({
        name: variable?.name ?? element.name ?? element.id,
        detail: `Input Data (${variable?.typeRef ?? 'any'})`,
        type: 'variable',
      });
    }
  }

  for (const element of drgElements) {
    if (element.$type === 'dmn:Decision') {
      const variable = element.variable;
      variables.push({
        name: variable?.name ?? element.name ?? element.id,
        detail: `Decision output (${variable?.typeRef ?? 'any'})`,
        type: 'variable',
      });
    }
  }

  for (const element of drgElements) {
    if (element.$type === 'dmn:BusinessKnowledgeModel') {
      const encapsulatedLogic = element.encapsulatedLogic;
      const params = encapsulatedLogic?.formalParameter ?? [];
      variables.push({
        name: element.variable?.name ?? element.name ?? element.id,
        detail: 'Business Knowledge Model',
        type: 'function',
        params: params.map((parameter: any) => ({
          name: parameter.name ?? '',
          type: parameter.typeRef,
        })),
      });
    }
  }

  const activeView = model.modelerAdapter.getActiveView();
  if (activeView?.type === 'decisionTable') {
    const decisionTable = model.elements.getActiveViewDecisionTable();
    if (decisionTable) {
      const inputs = model.elements.getDecisionTableInputs(decisionTable);
      for (const input of inputs) {
        const expression = input.inputExpression;
        if (expression?.text) {
          variables.push({
            name: expression.text,
            detail: `Table input (${expression.typeRef ?? 'any'})`,
            type: 'variable',
          });
        }
      }
    }
  }

  return variables;
}
