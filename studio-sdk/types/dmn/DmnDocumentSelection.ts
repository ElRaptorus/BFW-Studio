import { AbstractEmitter } from '../../index';
import type { DmnElement } from './DmnElementTypes';

export declare class DmnDocumentSelection extends AbstractEmitter {
  getElements(): DmnElement[];
  getOnlyElementOrNull(): DmnElement | null;
  isCurrentlySelected(elementId: string): boolean;
  selectElement(elementId: string): void;
  selectElements(elementIds: string[]): void;
  onlyElementIsType(type: string): boolean;
}
