import { DmnModdle } from 'dmn-moddle';

/* eslint-disable @typescript-eslint/no-unused-vars, no-var */
const window: any = self;
const global: any = self;
var Buffer: any = Buffer || [];
var process: any = process || {
  env: { DEBUG: undefined },
  version: [],
};
/* eslint-enable @typescript-eslint/no-unused-vars, no-var */

const moddle = new DmnModdle();

export type IndexedDmnElement = {
  description: string;
  id: string;
  metadata: any;
  name: string;
  type: string;
  expressionText?: string;
  hitPolicy?: string;
  typeRef?: string;
};

export async function getElementsFromXml(xml: string): Promise<IndexedDmnElement[]> {
  const definitions = await getDefinitionsFromModdle(xml);
  return getElementsFromDefinitions(definitions);
}

function getElementsFromDefinitions(definitions: any): IndexedDmnElement[] {
  const list: IndexedDmnElement[] = [];

  // Index the definitions root element
  list.push({
    type: 'dmn:Definitions',
    id: definitions.id ?? '',
    name: definitions.name ?? '',
    description: getDescription(definitions),
    metadata: { definitionId: definitions.id, isSelectable: true },
  });

  // Walk DRG elements (decisions, inputData, BKMs, knowledgeSources, decisionServices)
  const drgElements = definitions.drgElement ?? [];
  for (const element of drgElements) {
    const isSelectable = isElementOnDiagram(element, definitions);
    const baseMetadata = { definitionId: definitions.id, isSelectable };

    const indexed: IndexedDmnElement = {
      type: element.$type ?? '',
      id: element.id ?? '',
      name: element.name ?? '',
      description: getDescription(element),
      metadata: baseMetadata,
    };

    // Extract expression text for decisions
    if (element.$type === 'dmn:Decision') {
      const expression = element.decisionLogic;
      if (expression != null) {
        if (expression.$type === 'dmn:LiteralExpression' && expression.text != null) {
          indexed.expressionText = expression.text;
        } else if (expression.$type === 'dmn:DecisionTable') {
          indexed.hitPolicy = expression.hitPolicy ?? 'UNIQUE';
          indexed.expressionText = extractDecisionTableText(expression);
        }
      }
      if (element.variable?.typeRef) {
        indexed.typeRef = element.variable.typeRef;
      }
    }

    // Extract typeRef for inputData
    if (element.$type === 'dmn:InputData' && element.variable?.typeRef) {
      indexed.typeRef = element.variable.typeRef;
    }

    // Extract typeRef for BKMs
    if (element.$type === 'dmn:BusinessKnowledgeModel' && element.variable?.typeRef) {
      indexed.typeRef = element.variable.typeRef;
    }

    list.push(indexed);
  }

  // Walk item definitions
  const itemDefinitions = definitions.itemDefinition ?? [];
  for (const itemDef of itemDefinitions) {
    list.push({
      type: 'dmn:ItemDefinition',
      id: itemDef.id ?? '',
      name: itemDef.name ?? '',
      description: getDescription(itemDef),
      typeRef: itemDef.typeRef ?? undefined,
      metadata: { definitionId: definitions.id, isSelectable: false },
    });
  }

  return list;
}

function extractDecisionTableText(decisionTable: any): string {
  const parts: string[] = [];

  // Collect input expression texts
  const inputs = decisionTable.input ?? [];
  for (const input of inputs) {
    if (input.inputExpression?.text) {
      parts.push(input.inputExpression.text);
    }
    if (input.label) {
      parts.push(input.label);
    }
  }

  // Collect output labels
  const outputs = decisionTable.output ?? [];
  for (const output of outputs) {
    if (output.name) {
      parts.push(output.name);
    }
    if (output.label) {
      parts.push(output.label);
    }
  }

  // Collect rule entry texts
  const rules = decisionTable.rule ?? [];
  for (const rule of rules) {
    const inputEntries = rule.inputEntry ?? [];
    for (const entry of inputEntries) {
      if (entry.text && entry.text !== '-') {
        parts.push(entry.text);
      }
    }
    const outputEntries = rule.outputEntry ?? [];
    for (const entry of outputEntries) {
      if (entry.text) {
        parts.push(entry.text);
      }
    }
    if (rule.description) {
      parts.push(rule.description);
    }
  }

  return parts.join(' ');
}

function getDescription(element: any): string {
  if (element.description != null && typeof element.description === 'string') {
    return element.description;
  }
  return '';
}

function isElementOnDiagram(element: any, definitions: any): boolean {
  const dmndi = definitions.dmnDI;
  if (dmndi == null) {
    return false;
  }

  const diagrams = dmndi.diagrams ?? [];
  for (const diagram of diagrams) {
    const diagramElements = diagram.diagramElements ?? [];
    for (const diagramElement of diagramElements) {
      if (diagramElement.dmnElementRef?.id === element.id) {
        return true;
      }
    }
  }

  return false;
}

async function getDefinitionsFromModdle(data: string): Promise<any> {
  const { rootElement } = await moddle.fromXML(data);
  return rootElement;
}
