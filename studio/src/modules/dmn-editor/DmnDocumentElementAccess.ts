import type CommandStack from 'diagram-js/lib/command/CommandStack';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';

import { AbstractEmitter } from '@evil/bifrost_fw_sdk';

import type DmnModelerComponentAdapter from '../dmn-core/DmnModelerComponentAdapter';
import { CmdHelper } from '../dmn-core/dmn-js/CommandHandler/Helper/CmdHelper';
import type { DmnElement, DmnElementType, DmnExpressionType } from './DmnElementTypes';
import { getExpressionType, resolveElementType } from './DmnElementTypes';

export const EVENT_DMN_ELEMENT_PROPERTY_UPDATED = 'EVENT_DMN_ELEMENT_PROPERTY_UPDATED';

export default class DmnDocumentElementAccess extends AbstractEmitter {
  private adapter: DmnModelerComponentAdapter;

  constructor(adapter: DmnModelerComponentAdapter) {
    super();
    this.adapter = adapter;
  }

  castElement(modelerElement: any): DmnElement {
    const businessObject = modelerElement?.businessObject ?? modelerElement;
    const moddleType: string = businessObject?.$type ?? '';
    const elementType = resolveElementType(moddleType);

    return {
      id: businessObject?.id ?? modelerElement?.id ?? '',
      name: businessObject?.name ?? '',
      type: elementType ?? (moddleType as DmnElementType),
      businessObject,
    };
  }

  getById(elementId: string): DmnElement | null {
    const elementRegistry = this.getDrdElementRegistry();
    if (!elementRegistry) {
      return null;
    }

    const element = elementRegistry.get(elementId);
    if (!element) {
      return null;
    }

    return this.castElement(element);
  }

  getElementType(elementId: string): DmnElementType | null {
    const element = this.getById(elementId);
    return element?.type ?? null;
  }

  getBusinessObject(elementId: string): any | null {
    const elementRegistry = this.getDrdElementRegistry();
    if (!elementRegistry) {
      return null;
    }

    const element = elementRegistry.get(elementId);
    return element?.businessObject ?? null;
  }

  getDefinitions(): any | null {
    const moddle = this.adapter.getModdle();
    if (!moddle) {
      return null;
    }

    const modeler = this.adapter.getModeler();
    const definitions = modeler?._definitions;
    return definitions ?? null;
  }

  getDecisionExpression(decisionId: string): DmnExpressionType {
    const businessObject = this.getBusinessObject(decisionId);
    if (!businessObject || businessObject.$type !== 'dmn:Decision') {
      return 'none';
    }
    return getExpressionType(businessObject);
  }

  getInformationRequirements(elementId: string): any[] {
    const businessObject = this.getBusinessObject(elementId);
    return businessObject?.informationRequirement ?? [];
  }

  getKnowledgeRequirements(elementId: string): any[] {
    const businessObject = this.getBusinessObject(elementId);
    return businessObject?.knowledgeRequirement ?? [];
  }

  getAuthorityRequirements(elementId: string): any[] {
    const businessObject = this.getBusinessObject(elementId);
    return businessObject?.authorityRequirement ?? [];
  }

  getVariable(elementId: string): any | null {
    const businessObject = this.getBusinessObject(elementId);
    return businessObject?.variable ?? null;
  }

  setElementProperty(elementId: string, propertyName: string, value: any): void {
    const elementRegistry = this.getDrdElementRegistry();
    if (!elementRegistry) {
      return;
    }

    const element = elementRegistry.get(elementId);
    if (!element) {
      return;
    }

    const businessObject = element.businessObject;
    const commandStack = this.getDrdCommandStack();
    if (!commandStack) {
      return;
    }

    if (propertyName === 'name') {
      this.updateBusinessObjectProperty(commandStack, element, businessObject, 'name', value);
      try {
        const modeling = this.adapter.getDrdViewer()?.get('modeling');
        if (modeling) {
          modeling.updateLabel(element, value);
        }
      } catch {
        // DRD label update is best-effort
      }
    } else if (propertyName === 'id') {
      this.updateBusinessObjectProperty(commandStack, element, businessObject, 'id', value);
    } else if (propertyName === 'variable.name') {
      this.updateVariableProperty(commandStack, element, businessObject, 'name', value);
    } else if (propertyName === 'variable.typeRef') {
      this.updateVariableProperty(commandStack, element, businessObject, 'typeRef', value);
    } else {
      this.updateBusinessObjectProperty(commandStack, element, businessObject, propertyName, value);
    }

    this.emit(EVENT_DMN_ELEMENT_PROPERTY_UPDATED, [{ elementId, propertyName, value }]);
  }

  setDefinitionsProperty(propertyName: string, value: any): void {
    const definitions = this.getDefinitions();
    if (!definitions) {
      return;
    }

    const commandStack = this.getDrdCommandStack();
    if (!commandStack) {
      return;
    }

    const elementRegistry = this.getDrdElementRegistry();
    const rootElement = elementRegistry?.getAll()?.[0];

    const descriptor = CmdHelper.updateBusinessObject(rootElement, definitions, { [propertyName]: value });
    commandStack.execute(descriptor.cmd, descriptor.context);

    this.emit(EVENT_DMN_ELEMENT_PROPERTY_UPDATED, [{ elementId: definitions.id, propertyName, value }]);
  }

  //#region Item Definitions

  getItemDefinitions(): any[] {
    const definitions = this.getDefinitions();
    return definitions?.itemDefinition ?? [];
  }

  addItemDefinition(properties: { name: string; typeRef?: string; isCollection?: boolean }): void {
    const definitions = this.getDefinitions();
    if (!definitions) {
      return;
    }

    const commandStack = this.getDrdCommandStack();
    if (!commandStack) {
      return;
    }

    const moddle = this.adapter.getModdle();
    const newItemDef = moddle.create('dmn:ItemDefinition', {
      id: `ItemDef_${crypto.randomUUID().slice(0, 8)}`,
      name: properties.name,
      typeRef: properties.typeRef ?? '',
      isCollection: properties.isCollection ?? false,
    });
    newItemDef.$parent = definitions;

    const elementRegistry = this.getDrdElementRegistry();
    const rootElement = elementRegistry?.getAll()?.[0];
    const descriptor = CmdHelper.addElementsToList(rootElement, definitions, 'itemDefinition', [newItemDef]);
    commandStack.execute(descriptor.cmd, descriptor.context);

    this.emit(EVENT_DMN_ELEMENT_PROPERTY_UPDATED, [
      { elementId: newItemDef.id, propertyName: 'itemDefinition', value: newItemDef },
    ]);
  }

  removeItemDefinition(itemDefinition: any): void {
    const definitions = this.getDefinitions();
    if (!definitions) {
      return;
    }

    const commandStack = this.getDrdCommandStack();
    if (!commandStack) {
      return;
    }

    const elementRegistry = this.getDrdElementRegistry();
    const rootElement = elementRegistry?.getAll()?.[0];
    const descriptor = CmdHelper.removeElementsFromList(rootElement, definitions, 'itemDefinition', undefined, [
      itemDefinition,
    ]);
    commandStack.execute(descriptor.cmd, descriptor.context);

    this.emit(EVENT_DMN_ELEMENT_PROPERTY_UPDATED, [
      { elementId: itemDefinition.id, propertyName: 'itemDefinition', value: null },
    ]);
  }

  updateItemDefinition(itemDefinition: any, propertyName: string, value: any): void {
    const commandStack = this.getDrdCommandStack();
    if (!commandStack) {
      return;
    }

    const elementRegistry = this.getDrdElementRegistry();
    const rootElement = elementRegistry?.getAll()?.[0];
    const descriptor = CmdHelper.updateBusinessObject(rootElement, itemDefinition, { [propertyName]: value });
    commandStack.execute(descriptor.cmd, descriptor.context);

    this.emit(EVENT_DMN_ELEMENT_PROPERTY_UPDATED, [{ elementId: itemDefinition.id, propertyName, value }]);
  }

  addItemComponent(parentItemDefinition: any, properties: { name: string; typeRef?: string }): void {
    const commandStack = this.getDrdCommandStack();
    if (!commandStack) {
      return;
    }

    const moddle = this.adapter.getModdle();
    const component = moddle.create('dmn:ItemDefinition', {
      id: `ItemComp_${crypto.randomUUID().slice(0, 8)}`,
      name: properties.name,
      typeRef: properties.typeRef ?? '',
    });
    component.$parent = parentItemDefinition;

    const elementRegistry = this.getDrdElementRegistry();
    const rootElement = elementRegistry?.getAll()?.[0];
    const descriptor = CmdHelper.addElementsToList(rootElement, parentItemDefinition, 'itemComponent', [component]);
    commandStack.execute(descriptor.cmd, descriptor.context);

    this.emit(EVENT_DMN_ELEMENT_PROPERTY_UPDATED, [
      { elementId: parentItemDefinition.id, propertyName: 'itemComponent', value: component },
    ]);
  }

  removeItemComponent(parentItemDefinition: any, component: any): void {
    const commandStack = this.getDrdCommandStack();
    if (!commandStack) {
      return;
    }

    const elementRegistry = this.getDrdElementRegistry();
    const rootElement = elementRegistry?.getAll()?.[0];
    const descriptor = CmdHelper.removeElementsFromList(rootElement, parentItemDefinition, 'itemComponent', undefined, [
      component,
    ]);
    commandStack.execute(descriptor.cmd, descriptor.context);

    this.emit(EVENT_DMN_ELEMENT_PROPERTY_UPDATED, [
      { elementId: parentItemDefinition.id, propertyName: 'itemComponent', value: null },
    ]);
  }

  getItemDefinitionNames(): string[] {
    return this.getItemDefinitions()
      .map((itemDef: any) => itemDef.name)
      .filter(Boolean);
  }

  //#endregion Item Definitions

  //#region Imports

  getImports(): any[] {
    const definitions = this.getDefinitions();
    return definitions?.import ?? [];
  }

  addImport(properties: { namespace: string; locationURI?: string; importType?: string }): void {
    const definitions = this.getDefinitions();
    if (!definitions) {
      return;
    }

    const commandStack = this.getDrdCommandStack();
    if (!commandStack) {
      return;
    }

    const moddle = this.adapter.getModdle();
    const newImport = moddle.create('dmn:Import', {
      id: `Import_${crypto.randomUUID().slice(0, 8)}`,
      namespace: properties.namespace,
      locationURI: properties.locationURI ?? '',
      importType: properties.importType ?? 'https://www.omg.org/spec/DMN/20191111/MODEL/',
    });
    newImport.$parent = definitions;

    const elementRegistry = this.getDrdElementRegistry();
    const rootElement = elementRegistry?.getAll()?.[0];
    const descriptor = CmdHelper.addElementsToList(rootElement, definitions, 'import', [newImport]);
    commandStack.execute(descriptor.cmd, descriptor.context);

    this.emit(EVENT_DMN_ELEMENT_PROPERTY_UPDATED, [
      { elementId: newImport.id, propertyName: 'import', value: newImport },
    ]);
  }

  removeImport(importElement: any): void {
    const definitions = this.getDefinitions();
    if (!definitions) {
      return;
    }

    const commandStack = this.getDrdCommandStack();
    if (!commandStack) {
      return;
    }

    const elementRegistry = this.getDrdElementRegistry();
    const rootElement = elementRegistry?.getAll()?.[0];
    const descriptor = CmdHelper.removeElementsFromList(rootElement, definitions, 'import', undefined, [importElement]);
    commandStack.execute(descriptor.cmd, descriptor.context);

    this.emit(EVENT_DMN_ELEMENT_PROPERTY_UPDATED, [
      { elementId: importElement.id ?? '', propertyName: 'import', value: null },
    ]);
  }

  updateImport(importElement: any, propertyName: string, value: any): void {
    const commandStack = this.getDrdCommandStack();
    if (!commandStack) {
      return;
    }

    const elementRegistry = this.getDrdElementRegistry();
    const rootElement = elementRegistry?.getAll()?.[0];
    const descriptor = CmdHelper.updateBusinessObject(rootElement, importElement, { [propertyName]: value });
    commandStack.execute(descriptor.cmd, descriptor.context);

    this.emit(EVENT_DMN_ELEMENT_PROPERTY_UPDATED, [{ elementId: importElement.id ?? '', propertyName, value }]);
  }

  //#endregion Imports

  //#region Expression View Accessors

  getActiveViewDecisionTable(): any | null {
    const activeView = this.adapter.getActiveView();
    if (!activeView || activeView.type !== 'decisionTable') {
      return null;
    }
    const businessObject = activeView.element;
    return businessObject?.decisionLogic ?? businessObject?.expression ?? null;
  }

  getActiveViewLiteralExpression(): any | null {
    const activeView = this.adapter.getActiveView();
    if (!activeView || activeView.type !== 'literalExpression') {
      return null;
    }
    const businessObject = activeView.element;
    return businessObject?.decisionLogic ?? businessObject?.expression ?? null;
  }

  getActiveViewExpression(): { businessObject: any; type: string } | null {
    const activeView = this.adapter.getActiveView();
    if (!activeView) {
      return null;
    }
    const element = activeView.element;
    const expression = element?.decisionLogic ?? element?.expression ?? element?.encapsulatedLogic?.body;
    if (!expression) {
      return null;
    }
    return { businessObject: expression, type: expression.$type ?? '' };
  }

  getActiveViewDecisionElement(): any | null {
    const activeView = this.adapter.getActiveView();
    if (!activeView) {
      return null;
    }
    return activeView.element ?? null;
  }

  getDecisionTableInputs(decisionTable: any): any[] {
    return decisionTable?.input ?? [];
  }

  getDecisionTableOutputs(decisionTable: any): any[] {
    return decisionTable?.output ?? [];
  }

  getDecisionTableRuleCount(decisionTable: any): number {
    return decisionTable?.rule?.length ?? 0;
  }

  setExpressionViewProperty(propertyName: string, value: any): void {
    const activeView = this.adapter.getActiveView();
    if (!activeView) {
      return;
    }

    const element = activeView.element;
    const expression = element?.decisionLogic ?? element?.expression;
    if (!expression) {
      return;
    }

    const commandStack = this.getDrdCommandStack();
    if (!commandStack) {
      return;
    }

    const elementRegistry = this.getDrdElementRegistry();
    const drdElement = elementRegistry?.get(element.id);
    if (!drdElement) {
      return;
    }

    const descriptor = CmdHelper.updateBusinessObject(drdElement, expression, { [propertyName]: value });
    commandStack.execute(descriptor.cmd, descriptor.context);

    this.emit(EVENT_DMN_ELEMENT_PROPERTY_UPDATED, [{ elementId: element.id, propertyName, value }]);
  }

  setLiteralExpressionText(text: string): void {
    const literalExpression = this.getActiveViewLiteralExpression();
    if (!literalExpression) {
      return;
    }

    this.setExpressionViewProperty('text', text);
  }

  //#endregion Expression View Accessors

  countElementsByType(): Record<string, number> {
    const definitions = this.getDefinitions();
    if (!definitions) {
      return {};
    }

    const counts: Record<string, number> = {};
    const drgElements: any[] = definitions.drgElement ?? [];

    for (const element of drgElements) {
      const type = element.$type ?? 'unknown';
      counts[type] = (counts[type] ?? 0) + 1;
    }

    return counts;
  }

  getAllIds(): string[] {
    const elementRegistry = this.getDrdElementRegistry();
    if (!elementRegistry) {
      return [];
    }

    return elementRegistry
      .getAll()
      .map((element: any) => element.id)
      .filter(Boolean);
  }

  private updateBusinessObjectProperty(
    commandStack: CommandStack,
    element: any,
    businessObject: any,
    propertyName: string,
    value: any,
  ): void {
    const descriptor = CmdHelper.updateBusinessObject(element, businessObject, { [propertyName]: value });
    commandStack.execute(descriptor.cmd, descriptor.context);
  }

  private updateVariableProperty(
    commandStack: CommandStack,
    element: any,
    businessObject: any,
    propertyName: string,
    value: any,
  ): void {
    const variable = businessObject?.variable;
    if (!variable) {
      return;
    }

    const descriptor = CmdHelper.updateBusinessObject(element, variable, { [propertyName]: value });
    commandStack.execute(descriptor.cmd, descriptor.context);
  }

  private getDrdElementRegistry(): ElementRegistry | null {
    try {
      return this.adapter.getDrdElementRegistry();
    } catch {
      return null;
    }
  }

  private getDrdCommandStack(): CommandStack | null {
    try {
      return this.adapter.getDrdCommandStack();
    } catch {
      return null;
    }
  }
}
