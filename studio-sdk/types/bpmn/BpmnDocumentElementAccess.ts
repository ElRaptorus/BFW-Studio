import { AbstractEmitter } from '../../index';
import type {
  BpmnElement,
  BpmnElementColor,
  BpmnElementCustomProperty,
  BpmnElementType,
  FormAction,
  FormFieldDefinition,
} from './BpmnElementTypes';

declare type ModelerElementPropertyValue = any;

export declare class BpmnDocumentElementAccess extends AbstractEmitter {
  getFormFieldDefinitions(elementId: string): FormFieldDefinition[];

  setFormFieldDefinitions(elementId: string, fields: FormFieldDefinition[]): void;

  getFormActions(elementId: string): FormAction[];

  setFormActions(elementId: string, actions: FormAction[]): void;

  getAllIds(): string[];

  getColor(elementId: string): BpmnElementColor | null;

  setBackgroundColor(elementId: string, color: string): void;

  setBorderColor(elementId: string, color: string): void;

  setColor(elementId: string, color: BpmnElementColor | null): void;

  getByType<T = BpmnElement>(elementType: BpmnElementType): T[];

  getById(elementId: string): BpmnElement | null;

  getCustomProperties(elementId: string): BpmnElementCustomProperty[] | null;

  deleteCustomFormProperty(elementId: string, customFormPropertyName: string): void;

  setCustomProperty(elementId: string, propertyName: string, value: any): void;

  setCustomPropertyName(elementId: string, index: number, name: string): void;

  setCustomPropertyValue(elementId: string, index: number, value: string): void;

  addCustomProperty(elementId: string, name?: string, value?: string): void;

  deleteCustomProperty(elementId: string, index: number): void;

  getAllElements(): BpmnElement[] | null;

  setElementProperty(elementId: string, propertyName: string, propertyValue: ModelerElementPropertyValue): void;

  getElementPropertyValue(elementId: string, propertyName: string): ModelerElementPropertyValue;

  /**
   * Casts a given `element` from BpmnJS's modeler into Studio's typed format.
   */
  castElement(bpmnJsModelerElement: any): BpmnElement;
}
