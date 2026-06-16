import { AbstractEmitter } from '../../index';
import type { DmnElement, DmnElementType, DmnExpressionType } from './DmnElementTypes';

export declare class DmnDocumentElementAccess extends AbstractEmitter {
  castElement(modelerElement: any): DmnElement;
  getById(elementId: string): DmnElement | null;
  getElementType(elementId: string): DmnElementType | null;
  getBusinessObject(elementId: string): any | null;
  getDefinitions(): any | null;
  getDecisionExpression(decisionId: string): DmnExpressionType;
  getAllIds(): string[];
  countElementsByType(): Record<string, number>;
  setElementProperty(elementId: string, propertyName: string, propertyValue: any): void;
  setDefinitionsProperty(propertyName: string, value: any): void;
}
