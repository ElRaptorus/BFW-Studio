import type { Disposable } from './Disposable';

// --- Overlay Position & Style enums ---

export enum PluginDmnOverlayPosition {
  TopLeft = 'top-left',
  TopRight = 'top-right',
  MiddleLeft = 'middle-left',
  MiddleRight = 'middle-right',
  BottomLeft = 'bottom-left',
  BottomRight = 'bottom-right',
  Below = 'below',
}

export enum PluginDmnOverlayStyle {
  Info = 'info',
  Warning = 'warning',
  Error = 'error',
  Success = 'success',
  Neutral = 'neutral',
}

// --- Discriminated union overlay subtypes ---

export interface PluginDmnOverlayBadge {
  elementId: string;
  position: PluginDmnOverlayPosition;
  type: 'badge';
  /** Short label text (e.g. "3", "!", "OK"). Rendered as a text node, never as HTML. */
  text: string;
  /** Native browser tooltip shown on hover (via title attribute). */
  tooltip?: string;
  style?: PluginDmnOverlayStyle;
  /** Command ID to execute on click. Enables pointer-events for this overlay. Must be owned by the same plugin. */
  onClickCommand?: string;
  /** Optional arguments passed to the click command. */
  onClickCommandArgs?: unknown[];
}

export interface PluginDmnOverlayIcon {
  elementId: string;
  position: PluginDmnOverlayPosition;
  type: 'icon';
  /** Icon identifier (e.g. 'ph-light ph-warning-circle'). Resolved via the Studio icon system. */
  icon: string;
  /** Native browser tooltip shown on hover (via title attribute). */
  tooltip?: string;
  style?: PluginDmnOverlayStyle;
  /** Command ID to execute on click. Enables pointer-events for this overlay. Must be owned by the same plugin. */
  onClickCommand?: string;
  /** Optional arguments passed to the click command. */
  onClickCommandArgs?: unknown[];
}

export interface PluginDmnOverlayAction {
  elementId: string;
  position: PluginDmnOverlayPosition;
  type: 'action';
  /** Phosphor icon ID (light variant, e.g. "ph-light ph-play"). */
  icon: string;
  /** Phosphor icon ID for hover state. When omitted, derived automatically (ph-light -> ph-fill). */
  iconHover?: string;
  /** Native browser tooltip shown on hover (via title attribute). */
  tooltip?: string;
  /** Semantic color modifier. When omitted, uses the standard action gray (#607d8b). */
  style?: PluginDmnOverlayStyle;
  /** Command ID to execute on click (required — actions are always interactive). Must be owned by the same plugin. */
  onClickCommand: string;
  /** Optional arguments passed to the click command. */
  onClickCommandArgs?: unknown[];
}

export interface PluginDmnOverlayStatus {
  elementId: string;
  position: PluginDmnOverlayPosition;
  type: 'status';
  /** Phosphor icon ID (single icon, no hover swap). */
  icon?: string;
  /** Text content (e.g. a counter number "3"). Displayed alongside or instead of the icon. */
  text?: string;
  /** Native browser tooltip shown on hover (via title attribute). */
  tooltip?: string;
  /** Semantic color modifier. When omitted, uses the standard inverse gray. */
  style?: PluginDmnOverlayStyle;
}

export type PluginDmnOverlay =
  PluginDmnOverlayBadge | PluginDmnOverlayIcon | PluginDmnOverlayAction | PluginDmnOverlayStatus;

/**
 * Studio-semantic DMN DRD element types returned by `api.dmn.getElement` /
 * `getElements` and element events. These match `DmnElement.type` on the
 * typed document model (e.g. `'dmn:Decision'`), not untyped diagram-js leftovers.
 */
export const PluginDmnElementType = {
  Decision: 'dmn:Decision',
  InputData: 'dmn:InputData',
  BusinessKnowledgeModel: 'dmn:BusinessKnowledgeModel',
  KnowledgeSource: 'dmn:KnowledgeSource',
  DecisionService: 'dmn:DecisionService',
  TextAnnotation: 'dmn:TextAnnotation',
  Association: 'dmn:Association',
  InformationRequirement: 'dmn:InformationRequirement',
  KnowledgeRequirement: 'dmn:KnowledgeRequirement',
  AuthorityRequirement: 'dmn:AuthorityRequirement',
} as const;

export type PluginDmnElementType = (typeof PluginDmnElementType)[keyof typeof PluginDmnElementType];

// --- Event types ---

export interface DmnElementEvent {
  elementId: string;
  elementType: PluginDmnElementType | '';
  elementName: string | null;
}

export interface OverlayContextEvent {
  uri: string;
  reason: 'data-updated' | 'selection-changed' | 'document-opened' | 'view-changed';
}

/**
 * DMN documents have multiple views (DRD, decision table, literal expression,
 * boxed expression). The plugin API only operates on the DRD view — overlays,
 * palette/context-pad entries, modeling operations, and renderer modules are
 * inert while a non-DRD view is active.
 */
export type DmnViewType = 'drd' | 'decisionTable' | 'literalExpression' | 'boxedExpression';

export interface DmnViewChangedEvent {
  uri: string;
  viewType: DmnViewType;
  isDrd: boolean;
  /**
   * The id of the decision whose expression editor is active, when `viewType` is
   * `'decisionTable' | 'literalExpression' | 'boxedExpression'`. `null` while the DRD view
   * is active (`isDrd: true`), since the DRD has no single "current decision".
   */
  decisionId: string | null;
}

// --- Element snapshot types ---

export interface DmnElementSnapshot {
  id: string;
  type: PluginDmnElementType;
  name: string | null;
  parentId: string | null;
}

export interface DmnElementDetailSnapshot extends DmnElementSnapshot {
  properties: Record<string, unknown>;
  incoming: string[];
  outgoing: string[];
}

// --- Overlay descriptors ---

/**
 * Unified overlay descriptor union. Used as both the factory context type
 * (currentOverlays, originalDefaultOverlays) and the factory return type.
 *
 * Unlike BPMN, the DMN DRD view has no Studio-owned built-in overlay markers,
 * so this union only carries plugin-contributed overlay subtypes.
 */
export type DmnOverlayDescriptor =
  PluginDmnOverlayBadge | PluginDmnOverlayIcon | PluginDmnOverlayAction | PluginDmnOverlayStatus;

// --- Overlay Factory types ---

/**
 * Context passed to a plugin's overlay factory on each refresh cycle.
 * Object parameter ensures forward-compatible extensibility.
 */
export interface DmnOverlayFactoryContext {
  /** All elements on the current DRD plane. */
  elements: DmnElementDetailSnapshot[];
  /** Document URI — enables file-specific overlay logic when needed. */
  uri: string;
  /** The current overlay chain — output of the previous factory (empty for the first factory). */
  currentOverlays: DmnOverlayDescriptor[];
  /** The Studio's built-in overlays. Always empty for DMN — kept for structural parity with the BPMN API. */
  originalDefaultOverlays: DmnOverlayDescriptor[];
}

export interface DmnOverlayFactoryOptions {
  /**
   * Invocation priority. Factories are called in ascending order (lowest first).
   * Higher priority = called later = more power to override.
   * @default 100
   */
  priority?: number;
}

// --- DmnApi interface ---

/**
 * DMN editor plugin API. Allows plugins to read element data, subscribe to
 * editor events, place overlays, and query the DRD diagram model.
 *
 * All operations are scoped to the DRD (Decision Requirements Diagram) view —
 * DMN's decision table, literal expression, and boxed expression views are not
 * addressable by this API. Methods are no-ops (or return empty results) while
 * a non-DRD view is active; see {@link onViewChanged} to observe view switches.
 *
 * Requires the `'dmn'` permission (low risk).
 */
export interface DmnApi {
  /**
   * Replace all overlays for this plugin on the given document.
   * Previous overlays for this plugin+URI are removed before adding new ones.
   * No-op while the DRD view is not active.
   */
  setOverlays(uri: string, overlays: PluginDmnOverlay[]): Promise<void>;

  /**
   * Remove overlays placed by this plugin on the given document.
   * Optionally filter by elementId.
   */
  clearOverlays(uri: string, filter?: { elementId?: string }): Promise<void>;

  /** Subscribe to element selection changes in the given DMN document's DRD view. */
  onElementSelected(uri: string, callback: (event: DmnElementEvent) => void): Promise<Disposable>;

  /** Subscribe to element hover events in the given DMN document's DRD view. */
  onElementHover(uri: string, callback: (event: DmnElementEvent) => void): Promise<Disposable>;

  /** Subscribe to element double-click events in the given DMN document's DRD view. */
  onElementDoubleClick(uri: string, callback: (event: DmnElementEvent) => void): Promise<Disposable>;

  /** Subscribe to element context menu events in the given DMN document's DRD view. */
  onElementContextMenu(uri: string, callback: (event: DmnElementEvent) => void): Promise<Disposable>;

  /**
   * Subscribe to overlay context changes. Fires when a plugin should
   * refresh its overlays (data update, selection change, document opened, view changed).
   */
  onOverlayContextChanged(uri: string, callback: (event: OverlayContextEvent) => void): Promise<Disposable>;

  /**
   * Subscribe to active-view changes on the given DMN document
   * (DRD, decision table, literal expression, boxed expression).
   */
  onViewChanged(uri: string, callback: (event: DmnViewChangedEvent) => void): Promise<Disposable>;

  /** Get the currently active view for the given DMN document, or `null` if the document is not open. */
  getActiveView(uri: string): Promise<DmnViewChangedEvent | null>;

  /** Get all elements on the DRD plane of the given DMN document. Returns an empty array while DRD is inactive. */
  getElements(uri: string): Promise<DmnElementSnapshot[]>;

  /** Get detailed information about a specific DRD element. */
  getElement(uri: string, elementId: string): Promise<DmnElementDetailSnapshot | null>;

  /** Get the current DMN XML content. */
  getXml(uri: string): Promise<string>;

  /**
   * Request the editor to re-run all plugin overlay factories.
   *
   * Call this after your plugin's internal state has changed in a way that affects
   * what your overlay factory produces. The editor will invalidate the factory cache
   * and schedule a full overlay refresh cycle on all open DMN documents' DRD views.
   */
  requestOverlayRefresh(): Promise<void>;

  /**
   * Register an overlay factory that is called on every DRD overlay refresh cycle
   * (document open, data change, selection change, view change).
   *
   * The factory receives the current DRD element list and the overlay chain from previous
   * factories. It returns the final overlay set for the next factory in the chain.
   *
   * Only ONE factory per plugin is allowed. Re-registration replaces the previous factory.
   *
   * @param factory - Called with a DmnOverlayFactoryContext; must return DmnOverlayDescriptor[].
   * @param options - Optional configuration (priority for chain ordering).
   * @returns A disposable that unregisters the factory and triggers a re-render.
   */
  registerOverlayFactory(
    factory: (context: DmnOverlayFactoryContext) => DmnOverlayDescriptor[],
    options?: DmnOverlayFactoryOptions,
  ): Promise<Disposable>;

  /**
   * Register a palette entry at runtime. Requires 'dmn.modelling' permission.
   * The entry appears in the DRD palette under the "Plugins" group, and only
   * while the DRD view is active.
   */
  registerPaletteEntry(entry: PluginDmnPaletteEntry): Promise<void>;

  /** Remove a previously registered palette entry. */
  unregisterPaletteEntry(entryId: string): Promise<void>;

  /**
   * Register a context pad entry at runtime. Requires 'dmn.modelling' permission.
   * Supports two-level filtering: static elementTypes + dynamic elementIds allowlist.
   */
  registerContextPadEntry(entry: PluginDmnContextPadEntry): Promise<void>;

  /** Remove a previously registered context pad entry. */
  unregisterContextPadEntry(entryId: string): Promise<void>;

  /**
   * Update a registered context pad entry's dynamic allowlist.
   * Use this to control which elements the entry appears on without re-registering.
   *
   * - `{ elementIds: ['Decision_1', 'Decision_3'] }` — show only on listed elements.
   * - `{ elementIds: null }` — clear the allowlist (show on all type-matching elements).
   */
  updateContextPadEntry(entryId: string, update: ContextPadEntryUpdate): Promise<void>;

  // ─── Renderer Module Channel ─────────────────────────────────────────────

  /**
   * Subscribe to messages sent by this plugin's renderer-injected diagram-js module
   * via `pluginChannel.postMessage(data)`.
   *
   * Requires 'dmn.renderer' permission.
   */
  onRendererModuleMessage(callback: (data: unknown) => void): Promise<Disposable>;

  /**
   * Send a message to this plugin's renderer-injected diagram-js module.
   * The module receives it via `pluginChannel.onMessage(callback)`.
   *
   * Requires 'dmn.renderer' permission.
   */
  postToRendererModule(data: unknown): Promise<void>;

  // ─── Modeling ─────────────────────────────────────────────────────────────

  /**
   * DMN DRD Modeling sub-API. All operations are undoable (Ctrl+Z) and go through
   * the diagram-js commandStack. Requires 'dmn.modelling' permission.
   */
  readonly modeling: DmnModelingApi;
}

export type { Disposable } from './Disposable';

// ─── Palette & Context Pad types ────────────────────────────────────────────

export interface PluginDmnPaletteEntry {
  id: string;
  group?: string;
  icon: string;
  title: string;
  command: string;
}

export interface PluginDmnContextPadEntry {
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

/**
 * Descriptor for creating a new DRD element. Unlike BPMN (which appends
 * elements relative to a source via a sequence flow), DMN DRD elements are
 * created at an absolute canvas position — there is no implicit flow to
 * attach to.
 */
export interface CreateElementDescriptor {
  /** DRD element type, e.g. `'dmn:Decision'`, `'dmn:InputData'`, `'dmn:BusinessKnowledgeModel'`, `'dmn:KnowledgeSource'`, `'dmn:TextAnnotation'`. */
  type: string;
  name?: string;
  /** Absolute canvas position for the new element's top-left corner. */
  position: { x: number; y: number };
}

export interface CreateElementResult {
  elementId: string;
}

/**
 * Descriptor for appending a new DRD element relative to an existing one,
 * mirroring the BPMN API's `appendElement` shape. Placed next to the source
 * element and, when the pairing is valid, automatically connected with a
 * requirement.
 */
export interface AppendElementDescriptor {
  /** DRD element type, e.g. `'dmn:Decision'`, `'dmn:InputData'`, `'dmn:BusinessKnowledgeModel'`, `'dmn:KnowledgeSource'`, `'dmn:TextAnnotation'`. */
  type: string;
  name?: string;
}

export interface CreateConnectionResult {
  connectionId: string;
}

export interface MoveDelta {
  x: number;
  y: number;
}

/**
 * DMN DRD Modeling API — programmatic diagram modification.
 * All operations go through the diagram-js commandStack and are undoable.
 * Requires 'dmn.modelling' permission. All operations are no-ops (or reject)
 * while the DRD view is not active.
 */
export interface DmnModelingApi {
  /**
   * Update properties on a DRD element's business object.
   * Only primitive and array-of-primitive values are allowed.
   * Internal properties (`$parent`, `$type`, `di`) are blocked.
   */
  updateProperties(uri: string, elementId: string, properties: Record<string, unknown>): Promise<void>;

  /**
   * Remove an element from the DRD.
   */
  removeElement(uri: string, elementId: string): Promise<void>;

  /**
   * Create a new DRD element at an absolute canvas position.
   * Returns the ID of the newly created element.
   */
  createElement(uri: string, newElement: CreateElementDescriptor): Promise<CreateElementResult>;

  /**
   * Create a new DRD element next to an existing element (BPMN-style relative append).
   * Places the new element adjacent to `sourceElementId` and draws the connecting
   * requirement automatically. Returns the ID of the newly created element.
   */
  appendElement(
    uri: string,
    sourceElementId: string,
    newElement: AppendElementDescriptor,
  ): Promise<CreateElementResult>;

  /**
   * Create a requirement connection between two DRD elements.
   * `type` defaults to `'dmn:InformationRequirement'`; other valid values are
   * `'dmn:KnowledgeRequirement'` and `'dmn:AuthorityRequirement'`.
   */
  createConnection(uri: string, sourceId: string, targetId: string, type?: string): Promise<CreateConnectionResult>;

  /**
   * Move an element by a pixel delta.
   * Both `x` and `y` must be finite numbers.
   */
  moveElement(uri: string, elementId: string, delta: MoveDelta): Promise<void>;
}
