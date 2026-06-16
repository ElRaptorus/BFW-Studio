import { AbstractEmitter, assertNotNull } from '@evil/bifrost_fw_sdk';

import { parseDmnDefinitionsFromXml } from './dmnModdleForDiff';

export type DmnDiffChangesById = { [elementId: string]: DmnDiffChange[] };

export type DmnDiffChangesByAction = {
  added: DmnDiffChangesById;
  removed: DmnDiffChangesById;
  updated: DmnDiffChangesById;
  layoutChanged: DmnDiffChangesById;
};

export type DmnDiffChange = {
  id: string;
  action: string;
  $type: string;
  change: any;
};

export class DmnDiff extends AbstractEmitter {
  public changes: DmnDiffChangesByAction | null;
  public changesById: DmnDiffChangesById | null;
  public beforeXml: string;
  public afterXml: string;

  constructor(beforeXml: string, afterXml: string) {
    super();
    this.beforeXml = beforeXml;
    this.afterXml = afterXml;
    this.changes = null;
    this.changesById = null;
  }

  async diff(): Promise<DmnDiffChangesByAction> {
    const [defsBefore, defsAfter] = await Promise.all([
      parseDmnDefinitionsFromXml(this.beforeXml),
      parseDmnDefinitionsFromXml(this.afterXml),
    ]);

    const beforeElements = collectDrgElements(defsBefore);
    const afterElements = collectDrgElements(defsAfter);

    const beforeIds = new Set(Object.keys(beforeElements));
    const afterIds = new Set(Object.keys(afterElements));

    const added: DmnDiffChangesById = {};
    const removed: DmnDiffChangesById = {};
    const updated: DmnDiffChangesById = {};
    const layoutChanged: DmnDiffChangesById = {};

    // Added elements
    for (const id of afterIds) {
      if (!beforeIds.has(id)) {
        const element = afterElements[id];
        added[id] = [{ id, action: 'added', $type: element.$type, change: element }];
      }
    }

    // Removed elements
    for (const id of beforeIds) {
      if (!afterIds.has(id)) {
        const element = beforeElements[id];
        removed[id] = [{ id, action: 'removed', $type: element.$type, change: element }];
      }
    }

    for (const id of beforeIds) {
      if (!afterIds.has(id)) {
        continue;
      }

      const before = beforeElements[id];
      const after = afterElements[id];
      const attrs = diffElementAttributes(before, after);
      const diChanged = hasDiChanged(defsBefore, defsAfter, id);

      if (Object.keys(attrs).length > 0) {
        updated[id] = [
          {
            id,
            action: 'updated',
            $type: after.$type,
            change: { model: after, attrs },
          },
        ];
      }

      if (diChanged && Object.keys(attrs).length === 0) {
        layoutChanged[id] = [
          {
            id,
            action: 'layoutChanged',
            $type: after.$type,
            change: after,
          },
        ];
      }
    }

    const changes: DmnDiffChangesByAction = { added, removed, updated, layoutChanged };

    const allChanges: DmnDiffChange[] = [
      ...Object.values(added).flat(),
      ...Object.values(removed).flat(),
      ...Object.values(updated).flat(),
      ...Object.values(layoutChanged).flat(),
    ];

    const changesById: DmnDiffChangesById = {};
    for (const change of allChanges) {
      if (changesById[change.id] == null) {
        changesById[change.id] = [];
      }
      changesById[change.id].push(change);
    }

    this.changes = changes;
    this.changesById = changesById;

    return this.changes;
  }

  getChanges(): DmnDiffChangesByAction {
    assertNotNull(this.changes, 'this.changes');
    return this.changes;
  }

  getChangesById(elementId: string): DmnDiffChange[] {
    if (this.changesById == null) {
      return [];
    }
    return this.changesById[elementId] ?? [];
  }

  getAllChangesById(): DmnDiffChangesById {
    return this.changesById ?? {};
  }

  getAllChangedElementIds(): string[] {
    return Object.keys(this.getAllChangesById());
  }
}

const DRG_ELEMENT_TYPES = new Set([
  'dmn:Decision',
  'dmn:InputData',
  'dmn:BusinessKnowledgeModel',
  'dmn:KnowledgeSource',
  'dmn:DecisionService',
]);

function collectDrgElements(definitions: any): Record<string, any> {
  const elements: Record<string, any> = {};

  for (const child of definitions.drgElement ?? []) {
    if (child.id && DRG_ELEMENT_TYPES.has(child.$type)) {
      elements[child.id] = child;
    }
  }

  return elements;
}

const COMPARED_ATTRIBUTES = ['name', '$type'];

function getExpressionFingerprint(element: any): string | null {
  if (element.$type === 'dmn:Decision') {
    return fingerprintExpression(element.decisionLogic);
  }
  if (element.$type === 'dmn:BusinessKnowledgeModel') {
    const logic = element.encapsulatedLogic;
    if (logic == null) {
      return 'none';
    }
    const params = (logic.formalParameter ?? [])
      .map((parameter: any) => `${parameter.name ?? ''}:${parameter.typeRef ?? ''}`)
      .join(',');
    const bodyFingerprint = fingerprintExpression(logic.body);
    return `BKM:${params}:${bodyFingerprint}`;
  }
  return null;
}

function fingerprintExpression(expr: any): string {
  if (expr == null) {
    return 'none';
  }

  const type = expr.$type ?? 'unknown';

  if (type === 'dmn:DecisionTable') {
    const hitPolicy = expr.hitPolicy ?? 'UNIQUE';
    const aggregation = expr.aggregation ?? '';
    const inputCount = expr.input?.length ?? 0;
    const outputCount = expr.output?.length ?? 0;
    const ruleCount = expr.rule?.length ?? 0;
    const inputLabels = (expr.input ?? []).map((input: any) => input.inputExpression?.text ?? '').join(',');
    const outputLabels = (expr.output ?? []).map((output: any) => output.name ?? '').join(',');
    const ruleTexts = (expr.rule ?? [])
      .map((rule: any) => {
        const inputs = (rule.inputEntry ?? []).map((ie: any) => ie.text ?? '').join('|');
        const outputs = (rule.outputEntry ?? []).map((oe: any) => oe.text ?? '').join('|');
        return `${inputs}=>${outputs}`;
      })
      .join(';');
    return `DT:${hitPolicy}:${aggregation}:${inputCount}:${outputCount}:${ruleCount}:${inputLabels}:${outputLabels}:${ruleTexts}`;
  }

  if (type === 'dmn:LiteralExpression') {
    return `LE:${expr.text ?? ''}`;
  }

  if (type === 'dmn:Context') {
    const entries = (expr.contextEntry ?? [])
      .map((entry: any) => `${entry.variable?.name ?? '_'}=${fingerprintExpression(entry.expression)}`)
      .join(';');
    return `CTX:${entries}`;
  }

  if (type === 'dmn:Invocation') {
    const calledFunction = fingerprintExpression(expr.expression);
    const bindings = (expr.binding ?? [])
      .map((binding: any) => `${binding.parameter?.name ?? '_'}=${fingerprintExpression(binding.expression)}`)
      .join(';');
    return `INV:${calledFunction}:${bindings}`;
  }

  if (type === 'dmn:List') {
    const elements = (expr.expression ?? []).map((child: any) => fingerprintExpression(child)).join(';');
    return `LIST:${elements}`;
  }

  if (type === 'dmn:Relation') {
    const columns = (expr.column ?? []).map((col: any) => col.name ?? '').join(',');
    const rows = (expr.row ?? [])
      .map((row: any) => (row.expression ?? []).map((cell: any) => fingerprintExpression(cell)).join('|'))
      .join(';');
    return `REL:${columns}:${rows}`;
  }

  if (type === 'dmn:FunctionDefinition') {
    const params = (expr.formalParameter ?? [])
      .map((parameter: any) => `${parameter.name ?? ''}:${parameter.typeRef ?? ''}`)
      .join(',');
    return `FN:${params}:${fingerprintExpression(expr.body)}`;
  }

  return `${type}:${JSON.stringify(expr)}`;
}

function getRequirementsFingerprint(element: any): string {
  const parts: string[] = [];

  for (const req of element.informationRequirement ?? []) {
    const ref = req.requiredDecision?.href ?? req.requiredInput?.href ?? '';
    parts.push(`IR:${ref}`);
  }
  for (const req of element.knowledgeRequirement ?? []) {
    const ref = req.requiredKnowledge?.href ?? '';
    parts.push(`KR:${ref}`);
  }
  for (const req of element.authorityRequirement ?? []) {
    const ref = req.requiredAuthority?.href ?? req.requiredDecision?.href ?? req.requiredInput?.href ?? '';
    parts.push(`AR:${ref}`);
  }

  parts.sort();
  return parts.join('|');
}

function diffElementAttributes(before: any, after: any): Record<string, { oldValue: any; newValue: any }> {
  const attrs: Record<string, { oldValue: any; newValue: any }> = {};

  for (const attr of COMPARED_ATTRIBUTES) {
    const oldVal = before[attr];
    const newVal = after[attr];
    if (oldVal !== newVal) {
      attrs[attr] = { oldValue: oldVal, newValue: newVal };
    }
  }

  const beforeExpr = getExpressionFingerprint(before);
  const afterExpr = getExpressionFingerprint(after);
  if (beforeExpr !== afterExpr) {
    attrs['expression'] = { oldValue: beforeExpr, newValue: afterExpr };
  }

  const beforeReqs = getRequirementsFingerprint(before);
  const afterReqs = getRequirementsFingerprint(after);
  if (beforeReqs !== afterReqs) {
    attrs['requirements'] = { oldValue: beforeReqs, newValue: afterReqs };
  }

  if (before.variable?.name !== after.variable?.name) {
    attrs['variable.name'] = { oldValue: before.variable?.name, newValue: after.variable?.name };
  }
  if (before.variable?.typeRef !== after.variable?.typeRef) {
    attrs['variable.typeRef'] = { oldValue: before.variable?.typeRef, newValue: after.variable?.typeRef };
  }

  if (before.$type === 'dmn:DecisionService' || after.$type === 'dmn:DecisionService') {
    const beforeComposition = getDecisionServiceFingerprint(before);
    const afterComposition = getDecisionServiceFingerprint(after);
    if (beforeComposition !== afterComposition) {
      attrs['composition'] = { oldValue: beforeComposition, newValue: afterComposition };
    }
  }

  return attrs;
}

function getDecisionServiceFingerprint(element: any): string {
  const outputDecisions = (element.outputDecision ?? [])
    .map((ref: any) => ref.href ?? '')
    .sort()
    .join(',');
  const encapsulatedDecisions = (element.encapsulatedDecision ?? [])
    .map((ref: any) => ref.href ?? '')
    .sort()
    .join(',');
  const inputDecisions = (element.inputDecision ?? [])
    .map((ref: any) => ref.href ?? '')
    .sort()
    .join(',');
  const inputData = (element.inputData ?? [])
    .map((ref: any) => ref.href ?? '')
    .sort()
    .join(',');
  return `OD:${outputDecisions}|ED:${encapsulatedDecisions}|ID:${inputDecisions}|IN:${inputData}`;
}

function hasDiChanged(defsBefore: any, defsAfter: any, elementId: string): boolean {
  const diBefore = findDiShape(defsBefore, elementId);
  const diAfter = findDiShape(defsAfter, elementId);

  if (diBefore == null && diAfter == null) {
    return false;
  }
  if (diBefore == null || diAfter == null) {
    return true;
  }

  const boundsBefore = diBefore.bounds;
  const boundsAfter = diAfter.bounds;
  if (boundsBefore == null && boundsAfter == null) {
    return false;
  }
  if (boundsBefore == null || boundsAfter == null) {
    return true;
  }

  return (
    boundsBefore.x !== boundsAfter.x ||
    boundsBefore.y !== boundsAfter.y ||
    boundsBefore.width !== boundsAfter.width ||
    boundsBefore.height !== boundsAfter.height
  );
}

function findDiShape(definitions: any, elementId: string): any | null {
  for (const diagram of definitions.dmnDI?.diagrams ?? []) {
    for (const diagramElement of diagram.diagramElements ?? []) {
      if (diagramElement.$type === 'dmndi:DMNShape' && diagramElement.dmnElementRef?.id === elementId) {
        return diagramElement;
      }
    }
  }
  return null;
}
