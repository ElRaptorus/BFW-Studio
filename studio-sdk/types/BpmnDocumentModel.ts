import { EditorDocumentModel } from '../index';
import type { BpmnDocumentElementAccess } from './bpmn/BpmnDocumentElementAccess';
import type { BpmnDocumentSelection } from './bpmn/BpmnDocumentSelection';
import type { BpmnModelerComponentAdapter } from './bpmn/BpmnModelerComponentAdapter';

export { BpmnElementType } from './bpmn/BpmnElementTypes';
export type { BpmnElement } from './bpmn/BpmnElementTypes';
export type { FormFieldDefinition, FormFieldOption, FormAction } from './bpmn/BpmnElementTypes';
export { FormFieldType, FormActionPreset } from './bpmn/BpmnElementTypes';
export type { BpmnModelerComponentAdapter } from './bpmn/BpmnModelerComponentAdapter';

/**
 * Represents a BPMN document in the editor.
 */
export declare class BpmnDocumentModel extends EditorDocumentModel {
  readonly xmlLoaded: boolean;
  readonly elements: BpmnDocumentElementAccess;
  readonly selection: BpmnDocumentSelection;

  /**
   * Provides access to the underlying bpmn-js modeler adapter.
   *
   * Plugins can use this to retrieve diagram-js modules they registered
   * via `bpmn.modeler.registerModule`, e.g.:
   * ```
   * const bridge = model.modelerAdapter.getModelerComponentByName('myBridge');
   * ```
   */
  readonly modelerAdapter: BpmnModelerComponentAdapter;

  get dataObjectDetailLevel(): string;
  get showPreAndPostScriptMarkers(): boolean;
  get showDataContractMarker(): boolean;
  get showMultipleOutgoingSequenceFlowsMarkers(): boolean;
  get currentXml(): string;

  isReadyForInteraction(): boolean;
  onceInteractive(callbackFn: (...args: any[]) => any): void;
  getZoom(): number;
  getSvg(callbackFn: (...args: any[]) => any): void;
  zoomToElement(elementId: string): void;
  zoomToViewport(): void;
  setZoom(percentage: number): void;
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): void;
  redo(): void;
  copySelectedElements(): string | null;
  pasteElements(clipboardContent?: string): void;
  moveSelectedElements(direction: string, accelerated?: boolean): void;
  alignSelectedElements(direction: string): void;
  distributeSelectedElements(direction: string): void;
  getCurrentFilename(): string;
}
