import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';

import type DmnModelerComponentAdapter from '../dmn-core/DmnModelerComponentAdapter';
import { EVENT_DMN_ADAPTER_SELECTION_CHANGED } from '../dmn-core/DmnModelerComponentAdapter';
import type DmnDocumentElementAccess from './DmnDocumentElementAccess';
import type { DmnElement } from './DmnElementTypes';

export const EVENT_DMN_SELECTION_ELEMENTS_UPDATED = 'EVENT_DMN_SELECTION_ELEMENTS_UPDATED';

export default class DmnDocumentSelection extends AbstractEmitter {
  private adapter: DmnModelerComponentAdapter;
  private elementAccess: DmnDocumentElementAccess;
  private selection: DmnElement[] = [];

  constructor(adapter: DmnModelerComponentAdapter, elementAccess: DmnDocumentElementAccess) {
    super();
    this.adapter = adapter;
    this.elementAccess = elementAccess;

    this.adapter.on(EVENT_DMN_ADAPTER_SELECTION_CHANGED, (modelerSelection: any[]) => {
      const selectedElements = modelerSelection.map((modelerElement: any) =>
        this.elementAccess.castElement(modelerElement),
      );
      this.selection = selectedElements;
      this.emit(EVENT_DMN_SELECTION_ELEMENTS_UPDATED, [this.selection]);
    });
  }

  getElements(): DmnElement[] {
    if (!this.adapter.isDrdActive()) {
      return this.selection;
    }

    try {
      const drdSelection = this.adapter.getDrdSelection();
      const rawSelection = drdSelection.get();
      const filtered = rawSelection.filter((entry: any) => entry != null);
      return filtered.map((modelerElement: any) => this.elementAccess.castElement(modelerElement));
    } catch {
      return this.selection;
    }
  }

  getOnlyElementOrNull(): DmnElement | null {
    const elements = this.getElements();
    if (elements.length !== 1) {
      return null;
    }
    return elements[0];
  }

  onlyElementIsType(type: string): boolean {
    const element = this.getOnlyElementOrNull();
    return element?.type === type;
  }

  isCurrentlySelected(elementId: string): boolean {
    for (const selectedElement of this.getElements()) {
      if (selectedElement?.id === elementId) {
        return true;
      }
    }
    return false;
  }

  selectElement(elementId: string): void {
    if (!this.adapter.isDrdActive()) {
      return;
    }

    try {
      const selection = this.adapter.getDrdSelection();
      const elementRegistry = this.adapter.getDrdElementRegistry();
      const element = elementRegistry.get(elementId);
      if (element) {
        selection.select(element);
      }
    } catch {
      // Selection may fail if the element is not in the DRD view
    }
  }

  selectElements(elementIds: string[]): void {
    if (!this.adapter.isDrdActive()) {
      return;
    }

    try {
      const selection = this.adapter.getDrdSelection();
      const elementRegistry = this.adapter.getDrdElementRegistry();
      const elements = elementIds
        .map((id) => elementRegistry.get(id))
        .filter((element): element is NonNullable<typeof element> => element != null);

      if (elements.length > 0) {
        selection.select(elements);
      }
    } catch {
      // Selection may fail if elements are not in the DRD view
    }
  }

  clearSelection(): void {
    if (!this.adapter.isDrdActive()) {
      return;
    }

    try {
      this.adapter.getDrdSelection().select([]);
    } catch {
      // Selection may fail if the DRD viewer is not ready
    }
  }
}
