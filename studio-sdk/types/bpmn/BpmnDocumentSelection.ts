import { AbstractEmitter } from '../../index';
import type { BpmnElement } from './BpmnElementTypes';

export declare class BpmnDocumentSelection extends AbstractEmitter {
  getElements(): BpmnElement[];
  getOnlyElementOrNull(): BpmnElement | null;
  isCurrentlySelected(elementId: string): boolean;
  selectElement(elementId: string): void;
  selectElements(elementIds: string[]): void;
  updateSelectionIfIsCurrentlySelected(elementId: string, selectElementIdInstead: string): void;
  onlyElementIsType(type: string): boolean;
}
