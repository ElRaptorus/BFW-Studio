import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';

import type React from 'react';

import type { EditorDocument } from './EditorTypes';

/**
 * Represents a module exposing a `PaneProvider` by exporting a member named `paneProvider`.
 */
export type PaneProviderModule = {
  readonly paneProvider: PaneProvider;
};

/**
 * PaneProviders are exposing all functions necessary to render panes in Studio.
 */
export type PaneProvider = {
  /**
   * Returns the title of the pane for the described Editor context.
   */
  getPaneTitle(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel, studio: Bifrost): string;

  /**
   * Visibility gate. `PaneWrapper` evaluates this before mounting `Pane` /
   * `PaneContent`. Do not restate this predicate inside the renderer. A renderer
   * may still `return null` for conditions the gate does not cover (for example
   * modeler readiness or missing payload) so the header stays visible.
   */
  shouldBeDisplayed?(
    editorDocument: EditorDocument,
    editorDocumentModel: EditorDocumentModel,
    studio: Bifrost,
  ): boolean;

  Pane: FunctionReactComponent | ClassReactComponent;
  PaneTabOptions?: FunctionReactComponent | ClassReactComponent;
  PaneContent: FunctionReactComponent | ClassReactComponent;
  classNames?:
    | string
    | ((
        editorDocument: EditorDocument,
        editorDocumentModel: EditorDocumentModel,
        studio: Bifrost,
        paneObject: PaneObject,
      ) => string);
};

type FunctionReactComponent = (props: PaneComponentProps) => React.JSX.Element | null;
// TODO: this type if supposed to be something like `new () => React.Component;`, but it is not working
type ClassReactComponent = any;

export type PaneAreaName = 'left' | 'bottom' | 'right';

export type PaneAreaObject = {
  visible: boolean;
  sizeInPixels: number;
  paneGroups: PaneGroupObject[];
};

export type PaneGroupObject = {
  groupId: string;
  visible: boolean;
  panes: PaneObject[];
  activePaneIndex?: number;
  label?: string;
  icon?: string | (() => string);
};

export type PaneAreaAndGroup = {
  readonly paneArea: PaneAreaObject;
  readonly paneGroup: PaneGroupObject;
};

export type PaneObject = {
  readonly id: string;
  readonly providerId: string;
  readonly collapsed: boolean;
};

/**
 * Props given to pane components registered via `studio.panes`.
 */
export type PaneComponentProps = {
  readonly studio: Bifrost;
  readonly editorDocument: EditorDocument;
  readonly editorDocumentModel: any;
  readonly paneId: string;
  readonly collapsed: boolean;

  /**
   * Internal: used by react-dnd to provide drag-n-drop capabilitie
   */
  readonly connectDragSource: any;

  /**
   * Internal: used to communicate input state between pane tab options and pane content
   */
  readonly dataFromPaneTabOptions?: any;
};

/**
 * Props given to document inspector panes.
 * Note that the Document Model is optional, since Editor Documents are not required to use one.
 */
export type DocumentInspectorProps = {
  readonly studio: Bifrost;
  readonly editorDocument: EditorDocument;
  readonly editorDocumentModel?: any;
  readonly paneId?: string;
};

export type PaneAreasViewData = {
  readonly left: PaneAreaObject;
  readonly right: PaneAreaObject;
  readonly bottom: PaneAreaObject;
};

// the serialized data that goes into storage is the same as the data handed to the view (for now)
// but these are two conceptually different things, which is why we alias them here
export type PaneAreasSerialized = PaneAreasViewData;
