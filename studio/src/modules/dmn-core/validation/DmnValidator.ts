export type DmnValidationSeverity = 'error' | 'warning';

export type DmnViolation = {
  elementId: string;
  elementName: string;
  elementType: string;
  message: string;
  severity: DmnValidationSeverity;
  category: string;
};

const VALID_HIT_POLICIES = new Set(['UNIQUE', 'FIRST', 'ANY', 'COLLECT', 'RULE ORDER', 'OUTPUT ORDER', 'PRIORITY']);
const VALID_AGGREGATIONS = new Set(['SUM', 'MIN', 'MAX', 'COUNT']);

export class DmnValidator {
  validate(definitions: any): DmnViolation[] {
    if (!definitions) {
      return [];
    }

    const violations: DmnViolation[] = [];
    const drgElements: any[] = definitions.drgElement ?? [];

    for (const element of drgElements) {
      const elementType = element.$type ?? 'unknown';

      switch (elementType) {
        case 'dmn:Decision':
          this.validateDecision(element, violations, drgElements);
          break;
        case 'dmn:BusinessKnowledgeModel':
          this.validateBusinessKnowledgeModel(element, violations, drgElements);
          break;
        case 'dmn:DecisionService':
          this.validateDecisionService(element, violations, drgElements);
          break;
        default:
          break;
      }
    }

    this.validateInformationRequirements(drgElements, violations);
    this.validateKnowledgeRequirements(drgElements, violations);
    this.validateDecisionCycles(drgElements, violations);
    this.validateBkmCycles(drgElements, violations);
    this.validateItemDefinitions(definitions, violations);
    this.validateImports(definitions, violations);

    return violations;
  }

  private validateDecision(decision: any, violations: DmnViolation[], drgElements: any[]): void {
    const elementId = decision.id ?? '';
    const elementName = decision.name ?? '';

    const expression = decision.decisionLogic ?? decision.expression;
    if (!expression) {
      violations.push({
        elementId,
        elementName,
        elementType: 'Decision',
        message: 'Decision must have an expression (decision table, literal expression, or boxed expression).',
        severity: 'error',
        category: 'expression',
      });
      return;
    }

    const expressionType = expression.$type;

    switch (expressionType) {
      case 'dmn:DecisionTable':
        this.validateDecisionTable(expression, elementId, elementName, violations);
        break;
      case 'dmn:LiteralExpression':
        this.validateLiteralExpression(expression, elementId, elementName, violations);
        break;
      case 'dmn:Context':
        this.validateBoxedContext(expression, elementId, elementName, violations);
        break;
      case 'dmn:List':
        this.validateBoxedList(expression, elementId, elementName, violations);
        break;
      case 'dmn:Relation':
        this.validateRelation(expression, elementId, elementName, violations);
        break;
      case 'dmn:Conditional':
        this.validateConditional(expression, elementId, elementName, violations);
        break;
      case 'dmn:Filter':
        this.validateFilter(expression, elementId, elementName, violations);
        break;
      case 'dmn:Invocation':
        this.validateInvocation(expression, elementId, elementName, violations);
        break;
      case 'dmn:For':
      case 'dmn:Every':
      case 'dmn:Some':
        this.validateIterator(expression, elementId, elementName, violations);
        break;
      default:
        break;
    }
  }

  private validateDecisionTable(
    decisionTable: any,
    ownerElementId: string,
    ownerElementName: string,
    violations: DmnViolation[],
  ): void {
    const hitPolicy = decisionTable.hitPolicy ?? 'UNIQUE';
    if (!VALID_HIT_POLICIES.has(hitPolicy)) {
      violations.push({
        elementId: ownerElementId,
        elementName: ownerElementName,
        elementType: 'Decision Table',
        message: `Invalid hit policy "${hitPolicy}".`,
        severity: 'error',
        category: 'decision-table',
      });
    }

    const aggregation = decisionTable.aggregation;
    if (aggregation && hitPolicy !== 'COLLECT') {
      violations.push({
        elementId: ownerElementId,
        elementName: ownerElementName,
        elementType: 'Decision Table',
        message: 'Aggregation is only valid when hit policy is COLLECT.',
        severity: 'error',
        category: 'decision-table',
      });
    }
    if (aggregation && !VALID_AGGREGATIONS.has(aggregation)) {
      violations.push({
        elementId: ownerElementId,
        elementName: ownerElementName,
        elementType: 'Decision Table',
        message: `Invalid aggregation "${aggregation}".`,
        severity: 'error',
        category: 'decision-table',
      });
    }

    const inputs: any[] = decisionTable.input ?? [];
    const outputs: any[] = decisionTable.output ?? [];
    const rules: any[] = decisionTable.rule ?? [];

    if (inputs.length === 0) {
      violations.push({
        elementId: ownerElementId,
        elementName: ownerElementName,
        elementType: 'Decision Table',
        message: 'Decision table must have at least one input column.',
        severity: 'error',
        category: 'decision-table',
      });
    }

    if (outputs.length === 0) {
      violations.push({
        elementId: ownerElementId,
        elementName: ownerElementName,
        elementType: 'Decision Table',
        message: 'Decision table must have at least one output column.',
        severity: 'error',
        category: 'decision-table',
      });
    }

    if (rules.length === 0) {
      violations.push({
        elementId: ownerElementId,
        elementName: ownerElementName,
        elementType: 'Decision Table',
        message: 'Decision table must have at least one rule.',
        severity: 'warning',
        category: 'decision-table',
      });
    }

    const expectedInputEntries = inputs.length;
    const expectedOutputEntries = outputs.length;
    for (const rule of rules) {
      const inputEntries: any[] = rule.inputEntry ?? [];
      const outputEntries: any[] = rule.outputEntry ?? [];

      if (inputEntries.length !== expectedInputEntries) {
        violations.push({
          elementId: ownerElementId,
          elementName: ownerElementName,
          elementType: 'Decision Table',
          message: `Rule "${rule.id ?? '?'}" has ${inputEntries.length} input entries but the table has ${expectedInputEntries} input columns.`,
          severity: 'error',
          category: 'decision-table',
        });
      }
      if (outputEntries.length !== expectedOutputEntries) {
        violations.push({
          elementId: ownerElementId,
          elementName: ownerElementName,
          elementType: 'Decision Table',
          message: `Rule "${rule.id ?? '?'}" has ${outputEntries.length} output entries but the table has ${expectedOutputEntries} output columns.`,
          severity: 'error',
          category: 'decision-table',
        });
      }
    }
  }

  private validateLiteralExpression(
    literalExpression: any,
    ownerElementId: string,
    ownerElementName: string,
    violations: DmnViolation[],
  ): void {
    const text = literalExpression.text ?? '';
    if (typeof text === 'string' && text.trim() === '') {
      violations.push({
        elementId: ownerElementId,
        elementName: ownerElementName,
        elementType: 'Literal Expression',
        message: 'Literal expression text must not be blank.',
        severity: 'error',
        category: 'expression',
      });
    }
  }

  private validateBoxedContext(
    context: any,
    ownerElementId: string,
    ownerElementName: string,
    violations: DmnViolation[],
  ): void {
    const entries: any[] = context.contextEntry ?? [];

    if (entries.length === 0) {
      violations.push({
        elementId: ownerElementId,
        elementName: ownerElementName,
        elementType: 'Boxed Context',
        message: 'Boxed context must have at least one entry.',
        severity: 'error',
        category: 'expression',
      });
      return;
    }

    const variableNames = new Set<string>();
    for (const entry of entries) {
      const entryExpression = entry.value ?? entry.expression;
      if (!entryExpression) {
        violations.push({
          elementId: ownerElementId,
          elementName: ownerElementName,
          elementType: 'Boxed Context',
          message: `Context entry "${entry.variable?.name ?? entry.id ?? '?'}" must have an expression.`,
          severity: 'error',
          category: 'expression',
        });
      }

      const variableName = entry.variable?.name;
      if (variableName) {
        if (variableNames.has(variableName)) {
          violations.push({
            elementId: ownerElementId,
            elementName: ownerElementName,
            elementType: 'Boxed Context',
            message: `Duplicate variable name "${variableName}" in context entries.`,
            severity: 'error',
            category: 'expression',
          });
        }
        variableNames.add(variableName);
      }
    }
  }

  private validateBoxedList(
    list: any,
    ownerElementId: string,
    ownerElementName: string,
    violations: DmnViolation[],
  ): void {
    const elements: any[] = list.expression ?? [];
    if (elements.length === 0) {
      violations.push({
        elementId: ownerElementId,
        elementName: ownerElementName,
        elementType: 'Boxed List',
        message: 'Boxed list must have at least one element.',
        severity: 'error',
        category: 'expression',
      });
    }
  }

  private validateRelation(
    relation: any,
    ownerElementId: string,
    ownerElementName: string,
    violations: DmnViolation[],
  ): void {
    const columns: any[] = relation.column ?? [];
    const rows: any[] = relation.row ?? [];

    if (columns.length === 0) {
      violations.push({
        elementId: ownerElementId,
        elementName: ownerElementName,
        elementType: 'Relation',
        message: 'Relation must have at least one column.',
        severity: 'error',
        category: 'expression',
      });
    }

    for (const row of rows) {
      const cells: any[] = row.expression ?? [];
      if (cells.length !== columns.length) {
        violations.push({
          elementId: ownerElementId,
          elementName: ownerElementName,
          elementType: 'Relation',
          message: `Relation row "${row.id ?? '?'}" has ${cells.length} cells but the relation has ${columns.length} columns.`,
          severity: 'error',
          category: 'expression',
        });
      }
    }
  }

  private validateConditional(
    conditional: any,
    ownerElementId: string,
    ownerElementName: string,
    violations: DmnViolation[],
  ): void {
    if (!conditional.if) {
      violations.push({
        elementId: ownerElementId,
        elementName: ownerElementName,
        elementType: 'Conditional',
        message: 'Conditional expression must have an "if" branch.',
        severity: 'error',
        category: 'expression',
      });
    }
    if (!conditional.then) {
      violations.push({
        elementId: ownerElementId,
        elementName: ownerElementName,
        elementType: 'Conditional',
        message: 'Conditional expression must have a "then" branch.',
        severity: 'error',
        category: 'expression',
      });
    }
    if (!conditional.else) {
      violations.push({
        elementId: ownerElementId,
        elementName: ownerElementName,
        elementType: 'Conditional',
        message: 'Conditional expression must have an "else" branch.',
        severity: 'error',
        category: 'expression',
      });
    }
  }

  private validateFilter(
    filter: any,
    ownerElementId: string,
    ownerElementName: string,
    violations: DmnViolation[],
  ): void {
    if (!filter.in) {
      violations.push({
        elementId: ownerElementId,
        elementName: ownerElementName,
        elementType: 'Filter',
        message: 'Filter expression must have an "in" clause.',
        severity: 'error',
        category: 'expression',
      });
    }
    if (!filter.match) {
      violations.push({
        elementId: ownerElementId,
        elementName: ownerElementName,
        elementType: 'Filter',
        message: 'Filter expression must have a "match" clause.',
        severity: 'error',
        category: 'expression',
      });
    }
  }

  private validateInvocation(
    invocation: any,
    ownerElementId: string,
    ownerElementName: string,
    violations: DmnViolation[],
  ): void {
    const calledFunction = invocation.expression?.text ?? invocation.calledFunction?.text ?? '';
    if (typeof calledFunction === 'string' && calledFunction.trim() === '') {
      violations.push({
        elementId: ownerElementId,
        elementName: ownerElementName,
        elementType: 'Invocation',
        message: 'Invocation must specify a called function.',
        severity: 'error',
        category: 'expression',
      });
    }
  }

  private validateIterator(
    iterator: any,
    ownerElementId: string,
    ownerElementName: string,
    violations: DmnViolation[],
  ): void {
    const typeName = iterator.$type?.replace('dmn:', '') ?? 'Iterator';

    const iteratorVariable = iterator.iteratorVariable ?? iterator.variable?.name ?? '';
    if (typeof iteratorVariable === 'string' && iteratorVariable.trim() === '') {
      violations.push({
        elementId: ownerElementId,
        elementName: ownerElementName,
        elementType: typeName,
        message: `${typeName} expression must have a non-blank iterator variable.`,
        severity: 'error',
        category: 'expression',
      });
    }

    if (!iterator.in) {
      violations.push({
        elementId: ownerElementId,
        elementName: ownerElementName,
        elementType: typeName,
        message: `${typeName} expression must have an "in" clause.`,
        severity: 'error',
        category: 'expression',
      });
    }

    const body = iterator.return ?? iterator.satisfies ?? iterator.body;
    if (!body) {
      violations.push({
        elementId: ownerElementId,
        elementName: ownerElementName,
        elementType: typeName,
        message: `${typeName} expression must have a body expression.`,
        severity: 'error',
        category: 'expression',
      });
    }
  }

  private validateBusinessKnowledgeModel(bkm: any, violations: DmnViolation[], _drgElements: any[]): void {
    const elementId = bkm.id ?? '';
    const elementName = bkm.name ?? '';

    const encapsulatedLogic = bkm.encapsulatedLogic;
    if (!encapsulatedLogic) {
      violations.push({
        elementId,
        elementName,
        elementType: 'BKM',
        message: 'Business Knowledge Model must have encapsulated logic.',
        severity: 'error',
        category: 'structure',
      });
      return;
    }

    if (encapsulatedLogic.kind && encapsulatedLogic.kind !== 'FEEL') {
      violations.push({
        elementId,
        elementName,
        elementType: 'BKM',
        message: `BKM encapsulated logic kind must be "FEEL", got "${encapsulatedLogic.kind}".`,
        severity: 'error',
        category: 'structure',
      });
    }

    const body = encapsulatedLogic.body ?? encapsulatedLogic.expression;
    if (!body) {
      violations.push({
        elementId,
        elementName,
        elementType: 'BKM',
        message: 'BKM encapsulated logic must have a body expression.',
        severity: 'error',
        category: 'structure',
      });
    }

    const formalParams: any[] = encapsulatedLogic.formalParameter ?? [];
    const paramNames = new Set<string>();
    for (const param of formalParams) {
      const paramName = param.name ?? '';
      if (paramName && paramNames.has(paramName)) {
        violations.push({
          elementId,
          elementName,
          elementType: 'BKM',
          message: `Duplicate formal parameter name "${paramName}".`,
          severity: 'error',
          category: 'structure',
        });
      }
      if (paramName) {
        paramNames.add(paramName);
      }
    }
  }

  private validateDecisionService(decisionService: any, violations: DmnViolation[], drgElements: any[]): void {
    const elementId = decisionService.id ?? '';
    const elementName = decisionService.name ?? '';

    const outputDecisions: any[] = decisionService.outputDecision ?? [];
    if (outputDecisions.length === 0) {
      violations.push({
        elementId,
        elementName,
        elementType: 'Decision Service',
        message: 'Decision Service must have at least one output decision.',
        severity: 'error',
        category: 'structure',
      });
    }

    const drgElementIds = new Set(drgElements.map((element: any) => element.id).filter(Boolean));
    const allRefs = [
      ...outputDecisions,
      ...(decisionService.encapsulatedDecision ?? []),
      ...(decisionService.inputDecision ?? []),
      ...(decisionService.inputData ?? []),
    ];

    for (const ref of allRefs) {
      const href = ref.href?.replace('#', '') ?? '';
      if (href && !drgElementIds.has(href)) {
        violations.push({
          elementId,
          elementName,
          elementType: 'Decision Service',
          message: `Referenced element "${href}" does not exist in the model.`,
          severity: 'error',
          category: 'reference',
        });
      }
    }

    const outputIds = new Set(outputDecisions.map((ref: any) => ref.href?.replace('#', '')));
    const encapsulatedIds = new Set(
      (decisionService.encapsulatedDecision ?? []).map((ref: any) => ref.href?.replace('#', '')),
    );
    for (const outputId of outputIds) {
      if (outputId && encapsulatedIds.has(outputId)) {
        violations.push({
          elementId,
          elementName,
          elementType: 'Decision Service',
          message: `Decision "${outputId}" cannot be both an output decision and an encapsulated decision.`,
          severity: 'error',
          category: 'structure',
        });
      }
    }
  }

  private validateInformationRequirements(drgElements: any[], violations: DmnViolation[]): void {
    const elementIds = new Set(drgElements.map((element: any) => element.id).filter(Boolean));

    for (const element of drgElements) {
      const requirements: any[] = element.informationRequirement ?? [];
      for (const requirement of requirements) {
        const requiredDecision = requirement.requiredDecision;
        const requiredInput = requirement.requiredInput;

        if (requiredDecision) {
          const href = requiredDecision.href?.replace('#', '') ?? '';
          if (href && !elementIds.has(href)) {
            violations.push({
              elementId: element.id ?? '',
              elementName: element.name ?? '',
              elementType: element.$type?.replace('dmn:', '') ?? '',
              message: `Information requirement references non-existent decision "${href}".`,
              severity: 'error',
              category: 'reference',
            });
          }
        }
        if (requiredInput) {
          const href = requiredInput.href?.replace('#', '') ?? '';
          if (href && !elementIds.has(href)) {
            violations.push({
              elementId: element.id ?? '',
              elementName: element.name ?? '',
              elementType: element.$type?.replace('dmn:', '') ?? '',
              message: `Information requirement references non-existent input "${href}".`,
              severity: 'error',
              category: 'reference',
            });
          }
        }
      }
    }
  }

  private validateKnowledgeRequirements(drgElements: any[], violations: DmnViolation[]): void {
    const bkmIds = new Set(
      drgElements
        .filter((element: any) => element.$type === 'dmn:BusinessKnowledgeModel')
        .map((element: any) => element.id)
        .filter(Boolean),
    );

    for (const element of drgElements) {
      const requirements: any[] = element.knowledgeRequirement ?? [];
      for (const requirement of requirements) {
        const requiredKnowledge = requirement.requiredKnowledge;
        if (requiredKnowledge) {
          const href = requiredKnowledge.href?.replace('#', '') ?? '';
          if (href && !bkmIds.has(href)) {
            violations.push({
              elementId: element.id ?? '',
              elementName: element.name ?? '',
              elementType: element.$type?.replace('dmn:', '') ?? '',
              message: `Knowledge requirement references non-existent BKM "${href}".`,
              severity: 'error',
              category: 'reference',
            });
          }
        }
      }
    }
  }

  private validateDecisionCycles(drgElements: any[], violations: DmnViolation[]): void {
    const decisions = drgElements.filter((element: any) => element.$type === 'dmn:Decision');
    const adjacency = new Map<string, string[]>();

    for (const decision of decisions) {
      const dependencyIds: string[] = [];
      const requirements: any[] = decision.informationRequirement ?? [];
      for (const requirement of requirements) {
        const href = requirement.requiredDecision?.href?.replace('#', '');
        if (href) {
          dependencyIds.push(href);
        }
      }
      adjacency.set(decision.id, dependencyIds);
    }

    const cycleNodes = this.detectCycles(adjacency);
    if (cycleNodes.size > 0) {
      violations.push({
        elementId: '',
        elementName: '',
        elementType: 'DRG',
        message: `Cycle detected in decision requirements graph involving: ${[...cycleNodes].join(', ')}.`,
        severity: 'error',
        category: 'cycle',
      });
    }
  }

  private validateBkmCycles(drgElements: any[], violations: DmnViolation[]): void {
    const bkms = drgElements.filter((element: any) => element.$type === 'dmn:BusinessKnowledgeModel');
    const adjacency = new Map<string, string[]>();

    for (const bkm of bkms) {
      const dependencyIds: string[] = [];
      const requirements: any[] = bkm.knowledgeRequirement ?? [];
      for (const requirement of requirements) {
        const href = requirement.requiredKnowledge?.href?.replace('#', '');
        if (href) {
          dependencyIds.push(href);
        }
      }
      adjacency.set(bkm.id, dependencyIds);
    }

    const cycleNodes = this.detectCycles(adjacency);
    if (cycleNodes.size > 0) {
      violations.push({
        elementId: '',
        elementName: '',
        elementType: 'DRG',
        message: `Cycle detected in BKM knowledge requirements involving: ${[...cycleNodes].join(', ')}.`,
        severity: 'error',
        category: 'cycle',
      });
    }
  }

  private detectCycles(adjacency: Map<string, string[]>): Set<string> {
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const cycleNodes = new Set<string>();

    const visit = (node: string): boolean => {
      if (inStack.has(node)) {
        cycleNodes.add(node);
        return true;
      }
      if (visited.has(node)) {
        return false;
      }

      visited.add(node);
      inStack.add(node);

      const neighbors = adjacency.get(node) ?? [];
      for (const neighbor of neighbors) {
        if (visit(neighbor)) {
          cycleNodes.add(node);
        }
      }

      inStack.delete(node);
      return false;
    };

    for (const node of adjacency.keys()) {
      visit(node);
    }

    return cycleNodes;
  }

  private validateItemDefinitions(definitions: any, violations: DmnViolation[]): void {
    const itemDefinitions: any[] = definitions.itemDefinition ?? [];
    const names = new Set<string>();

    for (const itemDef of itemDefinitions) {
      const name = itemDef.name ?? '';
      if (name && names.has(name)) {
        violations.push({
          elementId: itemDef.id ?? '',
          elementName: name,
          elementType: 'ItemDefinition',
          message: `Duplicate item definition name "${name}".`,
          severity: 'error',
          category: 'item-definition',
        });
      }
      if (name) {
        names.add(name);
      }

      const typeRef = itemDef.typeRef ?? '';
      const itemComponents: any[] = itemDef.itemComponent ?? [];
      if (!typeRef && itemComponents.length === 0) {
        violations.push({
          elementId: itemDef.id ?? '',
          elementName: name,
          elementType: 'ItemDefinition',
          message: 'Item definition must have a typeRef or item components.',
          severity: 'warning',
          category: 'item-definition',
        });
      }
    }
  }

  private validateImports(definitions: any, violations: DmnViolation[]): void {
    const imports: any[] = definitions.import ?? [];

    for (const importElement of imports) {
      const namespace = importElement.namespace ?? '';
      if (typeof namespace === 'string' && namespace.trim() === '') {
        violations.push({
          elementId: importElement.id ?? '',
          elementName: importElement.name ?? '',
          elementType: 'Import',
          message: 'Import must have a non-blank namespace.',
          severity: 'error',
          category: 'import',
        });
      }
    }
  }
}
