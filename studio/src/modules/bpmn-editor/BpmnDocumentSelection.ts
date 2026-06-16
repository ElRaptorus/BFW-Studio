import type { BpmnElement } from '@evil/bifrost_fw_sdk';
import { AbstractEmitter } from '@evil/bifrost_fw_sdk';

import type BpmnModelerComponentAdapter from '../bpmn-core/BpmnModelerComponentAdapter';
import { EVENT_BPMN_MODELER_ADAPTER_SELECTION_CHANGED } from '../bpmn-core/BpmnModelerComponentAdapter';
import type BpmnDocumentElementAccess from './BpmnDocumentElementAccess';

export const EVENT_BPMN_SELECTION_ELEMENTS_UPDATED = 'EVENT_BPMN_SELECTION_ELEMENTS_UPDATED';

export default class BpmnDocumentSelection extends AbstractEmitter {
  private bpmnComponentAdapter: BpmnModelerComponentAdapter;
  private elementAccess: BpmnDocumentElementAccess;
  private selection: BpmnElement[] = [];

  constructor(bpmnComponentAdapter: BpmnModelerComponentAdapter, elementAccess: BpmnDocumentElementAccess) {
    super();
    this.bpmnComponentAdapter = bpmnComponentAdapter;
    this.elementAccess = elementAccess;

    this.bpmnComponentAdapter.on(EVENT_BPMN_MODELER_ADAPTER_SELECTION_CHANGED, (bpmnModelerSelection: any[]) => {
      const selectedElements = bpmnModelerSelection.map((modelerElement: any) =>
        this.elementAccess.castElement(modelerElement),
      );
      this.selection = selectedElements;
      this.emit(EVENT_BPMN_SELECTION_ELEMENTS_UPDATED, [this.selection]);
    });
  }

  getElements(): BpmnElement[] {
    const selection = this.bpmnComponentAdapter.getSelection().get();

    const filteredSelection = selection.filter((entry: any) => entry != null);
    return filteredSelection.map((modelerElement: any) => this.elementAccess.castElement(modelerElement));
  }

  /**
   * Returns an element if it is the only element selected, returns `null` otherwise.
   */
  getOnlyElementOrNull(): BpmnElement | null {
    const selection = this.bpmnComponentAdapter.getSelection().get();

    if (selection.length !== 1) {
      return null;
    }

    return this.elementAccess.castElement(selection[0]);
  }

  onlyElementIsType(type: string): boolean {
    const element = this.getOnlyElementOrNull();

    return element?.type === type;
  }

  isCurrentlySelected(elementId: string): boolean {
    for (const selectedElement of this.getElements()) {
      if (selectedElement?.__internalModdleId === elementId) {
        return true;
      }
    }

    return false;
  }

  selectElement(elementId: string): void {
    const selection = this.bpmnComponentAdapter.getSelection();
    const elementRegistry = this.bpmnComponentAdapter.getElementRegistry();
    const element = elementRegistry.get(elementId);

    selection.select(element);
  }

  selectElements(elementIds: string[]): void {
    const selection = this.bpmnComponentAdapter.getSelection();
    const elementRegistry = this.bpmnComponentAdapter.getElementRegistry();

    const elements = elementIds.map((elementId: string) => elementRegistry.get(elementId));

    const filteredElements = elements.filter((element) => element != null);
    selection.select(filteredElements);
  }

  updateSelectionIfIsCurrentlySelected(elementId: string, selectElementIdInstead: string): void {
    if (this.isCurrentlySelected(elementId)) {
      this.selectElement(selectElementIdInstead);
    }
  }
}
