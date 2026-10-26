import type { Disposable } from './Disposable';

// --- Overlay Position & Style enums ---

export enum PluginLandscapeOverlayPosition {
  TopLeft = 'top-left',
  TopRight = 'top-right',
  MiddleLeft = 'middle-left',
  MiddleRight = 'middle-right',
  BottomLeft = 'bottom-left',
  BottomRight = 'bottom-right',
  Below = 'below',
}

export enum PluginLandscapeOverlayStyle {
  Info = 'info',
  Warning = 'warning',
  Error = 'error',
  Success = 'success',
  Neutral = 'neutral',
}

// --- Discriminated union overlay subtypes ---

export interface PluginLandscapeOverlayBadge {
  elementId: string;
  position: PluginLandscapeOverlayPosition;
  type: 'badge';
  /** Short label text (e.g. "3", "!", "OK"). Rendered as a text node, never as HTML. */
  text: string;
  /** Native browser tooltip shown on hover (via title attribute). */
  tooltip?: string;
  style?: PluginLandscapeOverlayStyle;
  /** Command ID to execute on click. Enables pointer-events for this overlay. Must be owned by the same plugin. */
  onClickCommand?: string;
  /** Optional arguments passed to the click command. */
  onClickCommandArgs?: unknown[];
}

export interface PluginLandscapeOverlayIcon {
  elementId: string;
  position: PluginLandscapeOverlayPosition;
  type: 'icon';
  /** Icon identifier (e.g. 'ph-light ph-warning-circle'). Resolved via the Studio icon system. */
  icon: string;
  /** Native browser tooltip shown on hover (via title attribute). */
  tooltip?: string;
  style?: PluginLandscapeOverlayStyle;
  /** Command ID to execute on click. Enables pointer-events for this overlay. Must be owned by the same plugin. */
  onClickCommand?: string;
  /** Optional arguments passed to the click command. */
  onClickCommandArgs?: unknown[];
}

export interface PluginLandscapeOverlayAction {
  elementId: string;
  position: PluginLandscapeOverlayPosition;
  type: 'action';
  /** Phosphor icon ID (light variant, e.g. "ph-light ph-play"). */
  icon: string;
  /** Phosphor icon ID for hover state. When omitted, derived automatically (ph-light -> ph-fill). */
  iconHover?: string;
  /** Native browser tooltip shown on hover (via title attribute). */
  tooltip?: string;
  /** Semantic color modifier. When omitted, uses the standard action gray. */
  style?: PluginLandscapeOverlayStyle;
  /** Command ID to execute on click (required — actions are always interactive). Must be owned by the same plugin. */
  onClickCommand: string;
  /** Optional arguments passed to the click command. */
  onClickCommandArgs?: unknown[];
}

export interface PluginLandscapeOverlayStatus {
  elementId: string;
  position: PluginLandscapeOverlayPosition;
  type: 'status';
  /** Phosphor icon ID (single icon, no hover swap). */
  icon?: string;
  /** Text content (e.g. a counter number "3"). Displayed alongside or instead of the icon. */
  text?: string;
  /** Native browser tooltip shown on hover (via title attribute). */
  tooltip?: string;
  /** Semantic color modifier. When omitted, uses the standard inverse gray. */
  style?: PluginLandscapeOverlayStyle;
}

export type PluginLandscapeOverlay =
  | PluginLandscapeOverlayBadge
  | PluginLandscapeOverlayIcon
  | PluginLandscapeOverlayAction
  | PluginLandscapeOverlayStatus;

/**
 * Element types of a landscape map as returned by `api.landscape.getElement` / `getElements` and element events.
 * `relation` lines are derived from the solution (call, message and signal relations between processes) and are
 * never saved in the map file; `connector` is a line the user drew between two elements.
 */
export const PluginLandscapeElementType = {
  Band: 'band',
  Group: 'group',
  Process: 'process',
  Placeholder: 'placeholder',
  MapLink: 'mapLink',
  Note: 'note',
  Connector: 'connector',
  Relation: 'relation',
} as const;

export type PluginLandscapeElementType = (typeof PluginLandscapeElementType)[keyof typeof PluginLandscapeElementType];

// --- Event types ---

export interface LandscapeElementEvent {
  elementId: string;
  elementType: PluginLandscapeElementType | '';
  /** The label of the element (the text of a note); `null` when it has none. */
  elementName: string | null;
}

export interface LandscapeOverlayContextEvent {
  uri: string;
  reason: 'data-updated' | 'selection-changed' | 'document-opened';
}

// --- Element snapshot types ---

/** The fill and stroke colours of an element; `null` keeps the theme colour. */
export interface LandscapeElementStyleSnapshot {
  fill: string | null;
  stroke: string | null;
}

/** A band, group, process, placeholder, map link or note. Bounds are in diagram coordinates. */
export interface LandscapeShapeSnapshot {
  id: string;
  type: 'band' | 'group' | 'process' | 'placeholder' | 'mapLink' | 'note';
  /** The band or group that contains the element; `null` at top level. */
  parentId: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Band, group, placeholder and map link label; a process label that replaces the process name. `null` when absent. */
  label: string | null;
  /** The text of a note; `null` for every other type. */
  text: string | null;
  /** The BPMN process id of a process element; `null` for every other type. */
  processId: string | null;
  /** The BPMN file of a process element, relative to the map file; `null` when not recorded. */
  fileHint: string | null;
  /** The linked map of a map link, as a file URI; `null` for every other type. */
  mapUri: string | null;
  style: LandscapeElementStyleSnapshot | null;
  /** `'box'` or `'chevron'` for a process or placeholder; `null` for every other type. */
  shape: 'box' | 'chevron' | null;
  /** Whether a group is collapsed; `null` for every other type. */
  collapsed: boolean | null;
}

/** A line the user drew between two elements. */
export interface LandscapeConnectorSnapshot {
  id: string;
  type: 'connector';
  sourceId: string;
  targetId: string;
  label: string;
}

/** A derived line between two elements for the call, message or signal relations of their processes. */
export interface LandscapeRelationSnapshot {
  id: string;
  type: 'relation';
  kind: 'callActivity' | 'message' | 'signal';
  /** The name of the message or signal when the line stands for exactly one; otherwise `null`. */
  name: string | null;
  sourceElementId: string;
  targetElementId: string;
}

export type LandscapeElementSnapshot = LandscapeShapeSnapshot | LandscapeConnectorSnapshot | LandscapeRelationSnapshot;

// --- Overlay descriptors ---

/**
 * Unified overlay descriptor union. Used as both the factory context type
 * (currentOverlays, originalDefaultOverlays) and the factory return type.
 *
 * The landscape map editor has no Studio-owned overlay markers, so this union only carries plugin-contributed
 * overlay subtypes.
 */
export type LandscapeOverlayDescriptor =
  | PluginLandscapeOverlayBadge
  | PluginLandscapeOverlayIcon
  | PluginLandscapeOverlayAction
  | PluginLandscapeOverlayStatus;

// --- Overlay Factory types ---

/**
 * Context passed to a plugin's overlay factory on each refresh cycle.
 * Object parameter ensures forward-compatible extensibility.
 */
export interface LandscapeOverlayFactoryContext {
  /** All elements on the plane on screen: the map, or the open group. */
  elements: LandscapeElementSnapshot[];
  /** Document URI — enables file-specific overlay logic when needed. */
  uri: string;
  /** The current overlay chain — output of the previous factory (empty for the first factory). */
  currentOverlays: LandscapeOverlayDescriptor[];
  /** The Studio's built-in overlays. Always empty for landscape maps — kept for structural parity with the BPMN API. */
  originalDefaultOverlays: LandscapeOverlayDescriptor[];
}

export interface LandscapeOverlayFactoryOptions {
  /**
   * Invocation priority. Factories are called in ascending order (lowest first).
   * Higher priority = called later = more power to override.
   * @default 100
   */
  priority?: number;
}

// --- Palette & Context Pad types ---

export interface PluginLandscapePaletteEntry {
  id: string;
  group?: string;
  icon: string;
  title: string;
  command: string;
}

export interface PluginLandscapeContextPadEntry {
  id: string;
  icon: string;
  title: string;
  command: string;
  /** Static filter on element types, for example `['process']`. Omit to match every element. */
  elementTypes?: string[];
  /** Dynamic allowlist of element ids; change it later with {@link LandscapeApi.updateContextPadEntry}. */
  elementIds?: string[];
}

export interface LandscapeContextPadEntryUpdate {
  elementIds?: string[] | null;
}

// --- Modeling API types ---

/**
 * Descriptor for creating a new element on a landscape map at an absolute position (the top-left corner).
 * A process needs `processId`, a map link needs `mapUri`. Bands, groups and map links are created with their
 * default size; relation lines and connectors are not created here.
 */
export interface LandscapeCreateElementDescriptor {
  type: 'band' | 'group' | 'process' | 'placeholder' | 'mapLink' | 'note';
  /** Label of a band, group, placeholder or map link, or the label that replaces a process name. */
  label?: string;
  /** Text of a note. */
  text?: string;
  /** Required for a process: the BPMN process id. */
  processId?: string;
  /** For a process: the BPMN file relative to the map file, to tell processes with the same id apart. */
  fileHint?: string;
  /** Required for a map link: the file URI of the linked map. */
  mapUri?: string;
  position: { x: number; y: number };
}

export interface LandscapeCreateElementResult {
  elementId: string;
}

export interface LandscapeCreateConnectionResult {
  connectionId: string;
}

export interface LandscapeMoveDelta {
  x: number;
  y: number;
}

/**
 * Landscape map modeling API — programmatic map modification.
 * All operations go through the diagram-js commandStack and are undoable.
 * Requires 'landscape.modelling' permission. Relation lines, the root and unknown element types are refused with
 * a diagnostic message.
 */
export interface LandscapeModelingApi {
  /**
   * Update properties of an element: `label`, `text`, `style`, `shape`, `collapsed`, `processId`, `fileHint`,
   * `mapUri`. Only the properties valid for the element's type are accepted.
   */
  updateProperties(uri: string, elementId: string, properties: Record<string, unknown>): Promise<void>;

  /** Remove an element and, with it, the elements it contains and the connectors that end on it. */
  removeElement(uri: string, elementId: string): Promise<void>;

  /** Create a new element at an absolute position, inside the smallest open group or band that contains it. */
  createElement(uri: string, newElement: LandscapeCreateElementDescriptor): Promise<LandscapeCreateElementResult>;

  /**
   * Create a new element next to an existing one, below it, and connect the two with a connector.
   * Returns the ID of the newly created element.
   */
  appendElement(
    uri: string,
    sourceElementId: string,
    newElement: Omit<LandscapeCreateElementDescriptor, 'position'>,
  ): Promise<LandscapeCreateElementResult>;

  /** Draw a connector between two elements. Rejected when the editor does not allow that connection. */
  createConnection(uri: string, sourceId: string, targetId: string): Promise<LandscapeCreateConnectionResult>;

  /** Move an element by a delta in diagram coordinates. Both `x` and `y` must be finite numbers. */
  moveElement(uri: string, elementId: string, delta: LandscapeMoveDelta): Promise<void>;
}

// --- LandscapeApi interface ---

/**
 * Landscape map editor plugin API. Allows plugins to read element data, subscribe to editor events, place overlays,
 * and query the elements of an open landscape map (`.bfwmap`).
 *
 * Requires the `'landscape'` permission (low risk).
 */
export interface LandscapeApi {
  /**
   * Replace all overlays for this plugin on the given map.
   * Previous overlays for this plugin+URI are removed before adding new ones.
   */
  setOverlays(uri: string, overlays: PluginLandscapeOverlay[]): Promise<void>;

  /**
   * Remove overlays placed by this plugin on the given map.
   * Optionally filter by elementId.
   */
  clearOverlays(uri: string, filter?: { elementId?: string }): Promise<void>;

  /** Subscribe to element selection changes in the given map. */
  onElementSelected(uri: string, callback: (event: LandscapeElementEvent) => void): Promise<Disposable>;

  /** Subscribe to element hover events in the given map. */
  onElementHover(uri: string, callback: (event: LandscapeElementEvent) => void): Promise<Disposable>;

  /** Subscribe to element double-click events in the given map. */
  onElementDoubleClick(uri: string, callback: (event: LandscapeElementEvent) => void): Promise<Disposable>;

  /** Subscribe to element context menu events in the given map. */
  onElementContextMenu(uri: string, callback: (event: LandscapeElementEvent) => void): Promise<Disposable>;

  /**
   * Subscribe to overlay context changes. Fires when a plugin should
   * refresh its overlays (data update, selection change, document opened).
   */
  onOverlayContextChanged(uri: string, callback: (event: LandscapeOverlayContextEvent) => void): Promise<Disposable>;

  /**
   * Get all elements of the given map, whatever plane is on screen. Relation lines are those drawn on the plane on
   * screen; connectors between hidden elements are included.
   */
  getElements(uri: string): Promise<LandscapeElementSnapshot[]>;

  /** Get one element of the given map, or `null` when the map is not open or the element does not exist. */
  getElement(uri: string, elementId: string): Promise<LandscapeElementSnapshot | null>;

  /** Get the current text of the map file, including unsaved changes. */
  getXml(uri: string): Promise<string | null>;

  /**
   * Register an overlay factory that is called on every refresh cycle (data update, selection change, document
   * opened).
   *
   * The factory receives the elements on the plane on screen and the overlay chain from previous factories. It
   * returns the final overlay set for the next factory in the chain.
   *
   * Only ONE factory per plugin is allowed. Re-registration replaces the previous factory.
   *
   * @param factory - Called with a LandscapeOverlayFactoryContext; must return LandscapeOverlayDescriptor[].
   * @param options - Optional configuration (priority for chain ordering).
   * @returns A disposable that unregisters the factory and triggers a re-render.
   */
  registerOverlayFactory(
    factory: (context: LandscapeOverlayFactoryContext) => LandscapeOverlayDescriptor[],
    options?: LandscapeOverlayFactoryOptions,
  ): Promise<Disposable>;

  /** Ask the Studio to run every registered overlay factory again, for example after external data changed. */
  requestOverlayRefresh(): Promise<void>;

  /**
   * Register a palette entry at runtime. Requires 'landscape.modelling' permission.
   * The entry appears in the map palette under the "Plugins" group.
   */
  registerPaletteEntry(entry: PluginLandscapePaletteEntry): Promise<void>;

  /** Remove a previously registered palette entry. */
  unregisterPaletteEntry(entryId: string): Promise<void>;

  /**
   * Register a context pad entry at runtime. Requires 'landscape.modelling' permission.
   * Supports two-level filtering: static elementTypes + dynamic elementIds allowlist.
   */
  registerContextPadEntry(entry: PluginLandscapeContextPadEntry): Promise<void>;

  /** Remove a previously registered context pad entry. */
  unregisterContextPadEntry(entryId: string): Promise<void>;

  /**
   * Update a registered context pad entry's dynamic allowlist.
   *
   * - `{ elementIds: ['order', 'payment'] }` — show only on listed elements.
   * - `{ elementIds: null }` — clear the allowlist (show on all type-matching elements).
   */
  updateContextPadEntry(entryId: string, update: LandscapeContextPadEntryUpdate): Promise<void>;

  // ─── Renderer Module Channel ─────────────────────────────────────────────

  /**
   * Subscribe to messages sent by this plugin's renderer-injected diagram-js module
   * via `pluginChannel.postMessage(data)`.
   *
   * Requires 'landscape.renderer' permission.
   */
  onRendererModuleMessage(callback: (data: unknown) => void): Promise<Disposable>;

  /**
   * Send a message to this plugin's renderer-injected diagram-js module.
   * The module receives it via `pluginChannel.onMessage(callback)`.
   *
   * Requires 'landscape.renderer' permission.
   */
  postToRendererModule(data: unknown): Promise<void>;

  // ─── Modeling ─────────────────────────────────────────────────────────────

  /**
   * Landscape map modeling sub-API. All operations are undoable (Ctrl+Z) and go through
   * the diagram-js commandStack. Requires 'landscape.modelling' permission.
   */
  readonly modeling: LandscapeModelingApi;
}
