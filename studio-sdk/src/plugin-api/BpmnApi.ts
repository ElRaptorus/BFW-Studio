// --- Overlay Position & Style enums ---

export enum PluginBpmnOverlayPosition {
  TopLeft = 'top-left',
  TopRight = 'top-right',
  MiddleLeft = 'middle-left',
  MiddleRight = 'middle-right',
  BottomLeft = 'bottom-left',
  BottomRight = 'bottom-right',
  Below = 'below',
}

export enum PluginBpmnOverlayStyle {
  Info = 'info',
  Warning = 'warning',
  Error = 'error',
  Success = 'success',
  Neutral = 'neutral',
}

// --- Discriminated union overlay subtypes ---

export interface PluginBpmnOverlayBadge {
  elementId: string;
  position: PluginBpmnOverlayPosition;
  type: 'badge';
  /** Short label text (e.g. "3", "!", "OK"). Rendered as a text node, never as HTML. */
  text: string;
  /** Native browser tooltip shown on hover (via title attribute). */
  tooltip?: string;
  style?: PluginBpmnOverlayStyle;
  /** Command ID to execute on click. Enables pointer-events for this overlay. Must be owned by the same plugin. */
  onClickCommand?: string;
  /** Optional arguments passed to the click command. */
  onClickCommandArgs?: unknown[];
}

export interface PluginBpmnOverlayIcon {
  elementId: string;
  position: PluginBpmnOverlayPosition;
  type: 'icon';
  /** Icon identifier (e.g. 'ph-light ph-warning-circle'). Resolved via the Studio icon system. */
  icon: string;
  /** Native browser tooltip shown on hover (via title attribute). */
  tooltip?: string;
  style?: PluginBpmnOverlayStyle;
  /** Command ID to execute on click. Enables pointer-events for this overlay. Must be owned by the same plugin. */
  onClickCommand?: string;
  /** Optional arguments passed to the click command. */
  onClickCommandArgs?: unknown[];
}

export interface PluginBpmnOverlayAction {
  elementId: string;
  position: PluginBpmnOverlayPosition;
  type: 'action';
  /** Phosphor icon ID (light variant, e.g. "ph-light ph-play"). */
  icon: string;
  /** Phosphor icon ID for hover state. When omitted, derived automatically (ph-light -> ph-fill). */
  iconHover?: string;
  /** Native browser tooltip shown on hover (via title attribute). */
  tooltip?: string;
  /** Semantic color modifier. When omitted, uses the standard action gray (#607d8b). */
  style?: PluginBpmnOverlayStyle;
  /** Command ID to execute on click (required — actions are always interactive). Must be owned by the same plugin. */
  onClickCommand: string;
  /** Optional arguments passed to the click command. */
  onClickCommandArgs?: unknown[];
}

export interface PluginBpmnOverlayStatus {
  elementId: string;
  position: PluginBpmnOverlayPosition;
  type: 'status';
  /** Phosphor icon ID (single icon, no hover swap). */
  icon?: string;
  /** Text content (e.g. a counter number "3"). Displayed alongside or instead of the icon. */
  text?: string;
  /** Native browser tooltip shown on hover (via title attribute). */
  tooltip?: string;
  /** Semantic color modifier. When omitted, uses the standard inverse gray. */
  style?: PluginBpmnOverlayStyle;
}

export type PluginBpmnOverlay =
  | PluginBpmnOverlayBadge
  | PluginBpmnOverlayIcon
  | PluginBpmnOverlayAction
  | PluginBpmnOverlayStatus;

// --- Event types ---

export interface BpmnElementEvent {
  elementId: string;
  elementType: string;
  elementName: string | null;
}

export interface OverlayContextEvent {
  uri: string;
  reason: 'data-updated' | 'selection-changed' | 'document-opened';
}

// --- Element snapshot types ---

export interface BpmnElementSnapshot {
  id: string;
  type: string;
  name: string | null;
  parentId: string | null;
}

export interface BpmnElementDetailSnapshot extends BpmnElementSnapshot {
  properties: Record<string, unknown>;
  incoming: string[];
  outgoing: string[];
}

// --- Internal overlay descriptors (Studio-owned, read-only for plugins) ---

export interface BpmnOverlayDocumentationMarker {
  type: 'documentation-marker';
  elementId: string;
  position: PluginBpmnOverlayPosition;
}

export interface BpmnOverlayCallActivityLink {
  type: 'call-activity-link';
  elementId: string;
  position: PluginBpmnOverlayPosition;
  targetProcessId: string;
}

export interface BpmnOverlayMultiFlowWarning {
  type: 'multi-flow-warning';
  elementId: string;
  position: PluginBpmnOverlayPosition;
  outgoingCount: number;
}

export interface BpmnOverlayNotExecutableMarker {
  type: 'not-executable-marker';
  elementId: string;
  position: PluginBpmnOverlayPosition;
}

/**
 * Unified overlay descriptor union. Used as both the factory context type
 * (currentOverlays, originalDefaultOverlays) and the factory return type.
 * Plugins can pass through internal overlay types unchanged or filter them by `type`.
 */
export type BpmnOverlayDescriptor =
  | PluginBpmnOverlayBadge
  | PluginBpmnOverlayIcon
  | PluginBpmnOverlayAction
  | PluginBpmnOverlayStatus
  | BpmnOverlayDocumentationMarker
  | BpmnOverlayCallActivityLink
  | BpmnOverlayMultiFlowWarning
  | BpmnOverlayNotExecutableMarker;

// --- Overlay Factory types ---

/**
 * Context passed to a plugin's overlay factory on each refresh cycle.
 * Object parameter ensures forward-compatible extensibility.
 */
export interface OverlayFactoryContext {
  /** All visible elements on the current diagram plane. */
  elements: BpmnElementDetailSnapshot[];
  /** Document URI — enables file-specific overlay logic when needed. */
  uri: string;
  /** The current overlay chain — output of the previous factory (or Studio defaults if first). */
  currentOverlays: BpmnOverlayDescriptor[];
  /** The Studio's built-in overlays, immutable. Same for every factory in the chain. */
  originalDefaultOverlays: BpmnOverlayDescriptor[];
}

export interface OverlayFactoryOptions {
  /**
   * Invocation priority. Factories are called in ascending order (lowest first).
   * Higher priority = called later = more power to override.
   * @default 100
   */
  priority?: number;
}

// --- BpmnApi interface ---

/**
 * BPMN editor plugin API. Allows plugins to read element data, subscribe to
 * editor events, place overlays, and query the diagram model.
 *
 * Requires the `'bpmn'` permission (low risk).
 */
export interface BpmnApi {
  /**
   * Replace all overlays for this plugin on the given document.
   * Previous overlays for this plugin+URI are removed before adding new ones.
   */
  setOverlays(uri: string, overlays: PluginBpmnOverlay[]): Promise<void>;

  /**
   * Remove overlays placed by this plugin on the given document.
   * Optionally filter by elementId.
   */
  clearOverlays(uri: string, filter?: { elementId?: string }): Promise<void>;

  /** Subscribe to element selection changes in the given BPMN document. */
  onElementSelected(uri: string, callback: (event: BpmnElementEvent) => void): Promise<void>;

  /** Unsubscribe from element selection changes. */
  offElementSelected(uri: string, callback: (event: BpmnElementEvent) => void): Promise<void>;

  /** Subscribe to element hover events in the given BPMN document. */
  onElementHover(uri: string, callback: (event: BpmnElementEvent) => void): Promise<void>;

  /** Unsubscribe from element hover events. */
  offElementHover(uri: string, callback: (event: BpmnElementEvent) => void): Promise<void>;

  /** Subscribe to element double-click events in the given BPMN document. */
  onElementDoubleClick(uri: string, callback: (event: BpmnElementEvent) => void): Promise<void>;

  /** Unsubscribe from element double-click events. */
  offElementDoubleClick(uri: string, callback: (event: BpmnElementEvent) => void): Promise<void>;

  /** Subscribe to element context menu events in the given BPMN document. */
  onElementContextMenu(uri: string, callback: (event: BpmnElementEvent) => void): Promise<void>;

  /** Unsubscribe from element context menu events. */
  offElementContextMenu(uri: string, callback: (event: BpmnElementEvent) => void): Promise<void>;

  /**
   * Subscribe to overlay context changes. Fires when a plugin should
   * refresh its overlays (data update, selection change, document opened).
   */
  onOverlayContextChanged(uri: string, callback: (event: OverlayContextEvent) => void): Promise<void>;

  /** Unsubscribe from overlay context changes. */
  offOverlayContextChanged(uri: string, callback: (event: OverlayContextEvent) => void): Promise<void>;

  /** Get all elements in the given BPMN document. */
  getElements(uri: string): Promise<BpmnElementSnapshot[]>;

  /** Get detailed information about a specific element. */
  getElement(uri: string, elementId: string): Promise<BpmnElementDetailSnapshot | null>;

  /** Get the current BPMN XML content. */
  getXml(uri: string): Promise<string>;

  /**
   * Request the editor to re-run all plugin overlay factories.
   *
   * Call this after your plugin's internal state has changed in a way that affects
   * what your overlay factory produces. The editor will invalidate the factory cache
   * and schedule a full overlay refresh cycle on all open BPMN documents.
   */
  requestOverlayRefresh(): Promise<void>;

  /**
   * Register an overlay factory that is called on every BPMN overlay refresh cycle
   * (document open, data change, root change, settings change).
   *
   * The factory receives the current element list and the overlay chain from previous
   * factories. It returns the final overlay set for the next factory in the chain.
   *
   * Only ONE factory per plugin is allowed. Re-registration replaces the previous factory.
   *
   * @param factory - Called with an OverlayFactoryContext; must return BpmnOverlayDescriptor[].
   * @param options - Optional configuration (priority for chain ordering).
   * @returns A disposable that unregisters the factory and triggers a re-render.
   */
  registerOverlayFactory(
    factory: (context: OverlayFactoryContext) => BpmnOverlayDescriptor[],
    options?: OverlayFactoryOptions,
  ): Promise<{ dispose: () => void }>;

  /**
   * Register a palette entry at runtime. Requires 'bpmn.modelling' permission.
   * The entry appears in the BPMN palette under the "Plugins" group.
   */
  registerPaletteEntry(entry: PluginBpmnPaletteEntry): Promise<void>;

  /** Remove a previously registered palette entry. */
  unregisterPaletteEntry(entryId: string): Promise<void>;

  /**
   * Register a context pad entry at runtime. Requires 'bpmn.modelling' permission.
   * Supports two-level filtering: static elementTypes + dynamic elementIds allowlist.
   */
  registerContextPadEntry(entry: PluginBpmnContextPadEntry): Promise<void>;

  /** Remove a previously registered context pad entry. */
  unregisterContextPadEntry(entryId: string): Promise<void>;

  /**
   * Update a registered context pad entry's dynamic allowlist.
   * Use this to control which elements the entry appears on without re-registering.
   *
   * - `{ elementIds: ['Task_1', 'Task_3'] }` — show only on listed elements.
   * - `{ elementIds: null }` — clear the allowlist (show on all type-matching elements).
   */
  updateContextPadEntry(entryId: string, update: ContextPadEntryUpdate): Promise<void>;

  /**
   * BPMN Modeling sub-API. All operations are undoable (Ctrl+Z) and go through
   * the diagram-js commandStack. Requires 'bpmn.modelling' permission.
   */
  readonly modeling: BpmnModelingApi;
}

// ─── Palette & Context Pad types ────────────────────────────────────────────

export interface PluginBpmnPaletteEntry {
  id: string;
  group?: string;
  icon: string;
  title: string;
  command: string;
}

export interface PluginBpmnContextPadEntry {
  id: string;
  icon: string;
  title: string;
  command: string;
  elementTypes?: string[];
  elementIds?: string[];
}

export interface ContextPadEntryUpdate {
  elementIds?: string[] | null;
}

// ─── Modeling API types ─────────────────────────────────────────────────────

export interface AppendElementDescriptor {
  type: string;
  name?: string;
}

export interface AppendElementResult {
  elementId: string;
}

export interface CreateConnectionResult {
  connectionId: string;
}

export interface MoveDelta {
  x: number;
  y: number;
}

/**
 * BPMN Modeling API — programmatic diagram modification.
 * All operations go through the diagram-js commandStack and are undoable.
 * Requires 'bpmn.modelling' permission.
 */
export interface BpmnModelingApi {
  /**
   * Update properties on a BPMN element's business object.
   * Only primitive and array-of-primitive values are allowed.
   * Internal properties (`$parent`, `$type`, `di`) are blocked.
   */
  updateProperties(uri: string, elementId: string, properties: Record<string, unknown>): Promise<void>;

  /**
   * Remove an element from the diagram.
   * The root process element cannot be removed.
   */
  removeElement(uri: string, elementId: string): Promise<void>;

  /**
   * Append a new element connected to the source element via a sequence flow.
   * Returns the ID of the newly created element.
   */
  appendElement(
    uri: string,
    sourceElementId: string,
    newElement: AppendElementDescriptor,
  ): Promise<AppendElementResult>;

  /**
   * Create a connection (sequence flow) between two elements.
   * Optionally specify the connection type (defaults to 'bpmn:SequenceFlow').
   */
  createConnection(uri: string, sourceId: string, targetId: string, type?: string): Promise<CreateConnectionResult>;

  /**
   * Move an element by a pixel delta.
   * Both `x` and `y` must be finite numbers.
   */
  moveElement(uri: string, elementId: string, delta: MoveDelta): Promise<void>;
}
