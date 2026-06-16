import { EditorDocumentModel } from '../index';
import type { DmnDocumentElementAccess } from './dmn/DmnDocumentElementAccess';
import type { DmnDocumentSelection } from './dmn/DmnDocumentSelection';
import type { DmnModelerComponentAdapter, DmnViewType } from './dmn/DmnModelerComponentAdapter';

export { DmnElementType } from './dmn/DmnElementTypes';
export type { DmnAggregation, DmnElement, DmnExpressionType, DmnHitPolicy } from './dmn/DmnElementTypes';
export type { DmnDocumentElementAccess } from './dmn/DmnDocumentElementAccess';
export type { DmnDocumentSelection } from './dmn/DmnDocumentSelection';
export type { DmnModelerComponentAdapter, DmnView, DmnViewType } from './dmn/DmnModelerComponentAdapter';

export declare class DmnDocumentModel extends EditorDocumentModel {
  readonly xmlLoaded: boolean;
  readonly elements: DmnDocumentElementAccess;
  readonly selection: DmnDocumentSelection;
  readonly modelerAdapter: DmnModelerComponentAdapter;

  get currentXml(): string;

  getActiveViewType(): DmnViewType | null;
  isReadyForInteraction(): boolean;
  onceInteractive(callbackFn: (...args: any[]) => any): void;
  getZoom(): number;
  setZoom(percentage: number): void;
  zoomToViewport(): void;
  zoomToElement(elementId: string): void;
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): void;
  redo(): void;
  getCurrentFilename(): string;
}
