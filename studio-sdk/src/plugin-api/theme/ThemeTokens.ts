/**
 * CSS custom property names injected into plugin webview iframes.
 *
 * Values are live: `PluginHost.extractThemeTokens()` reads computed `--theme-*`
 * properties from any stylesheet rule whose selector contains `bifrost-theme--`
 * and posts them into the iframe. This map is the typed contract of those names.
 *
 * Use with `var()` in plugin CSS, e.g. `background: var(--theme-pane-bg)`.
 * Phosphor icon fonts are not injected into iframes; load them from the plugin
 * if you render `<span className="ph-light ph-…" />` inside a webview.
 */
export const ThemeToken = {
  // ── Base ──
  Accent: '--theme-accent',
  Bg: '--theme-bg',
  Border: '--theme-border',
  BorderSubtle: '--theme-border-subtle',
  /** Default foreground / body text. Used across host chrome and as iframe text color. */
  Fg: '--theme-fg',
  FgMuted: '--theme-fg-muted',
  FgOnAccent: '--theme-fg-on-accent',
  FgPlaceholder: '--theme-fg-placeholder',
  FgSecondary: '--theme-fg-secondary',
  Focus: '--theme-focus',
  Link: '--theme-link',
  Shadow: '--theme-shadow',

  // ── Icon colors ──
  IconBlue: '--theme-icon-blue',
  IconBrown: '--theme-icon-brown',
  IconGold: '--theme-icon-gold',
  IconGreen: '--theme-icon-green',
  IconGrey: '--theme-icon-grey',
  IconOlive: '--theme-icon-olive',
  IconOrange: '--theme-icon-orange',
  IconPink: '--theme-icon-pink',
  IconPurple: '--theme-icon-purple',
  IconRed: '--theme-icon-red',
  IconTeal: '--theme-icon-teal',
  IconViolet: '--theme-icon-violet',
  IconYellow: '--theme-icon-yellow',

  // ── Surfaces ──
  SurfaceBackdrop: '--theme-surface-backdrop',
  SurfaceCanvas: '--theme-surface-canvas',
  SurfaceElevated: '--theme-surface-elevated',
  SurfaceInset: '--theme-surface-inset',
  SurfacePrimary: '--theme-surface-primary',
  SurfaceSecondary: '--theme-surface-secondary',

  // ── Scrollbar ──
  ScrollbarThumb: '--theme-scrollbar-thumb',
  ScrollbarTrack: '--theme-scrollbar-track',

  // ── Splitter ──
  Splitter: '--theme-splitter',
  SplitterActive: '--theme-splitter-active',
  SplitterHover: '--theme-splitter-hover',

  // ── Menu bar ──
  MenuBarActiveBg: '--theme-menu-bar-active-bg',
  MenuBarBg: '--theme-menu-bar-bg',
  MenuBarFg: '--theme-menu-bar-fg',
  MenuBarHoverBg: '--theme-menu-bar-hover-bg',

  // ── Status bar ──
  StatusBarBg: '--theme-status-bar-bg',
  StatusBarBorder: '--theme-status-bar-border',
  StatusBarFg: '--theme-status-bar-fg',
  StatusBarHoverBg: '--theme-status-bar-hover-bg',
  StatusBarIconDuotonePrimary: '--theme-status-bar-icon-duotone-primary',
  StatusBarIconDuotoneSecondary: '--theme-status-bar-icon-duotone-secondary',
  StatusBarSolutionBadgeBg: '--theme-status-bar-solution-badge-bg',
  StatusBarSolutionBadgeHoverBg: '--theme-status-bar-solution-badge-hover-bg',

  // ── Editor ──
  EditorBg: '--theme-editor-bg',
  EditorCanvasBg: '--theme-editor-canvas-bg',
  EditorContentBorder: '--theme-editor-content-border',
  EditorLoadingBorder: '--theme-editor-loading-border',
  EditorLoadingErrorBg: '--theme-editor-loading-error-bg',
  EditorLoadingHintBg: '--theme-editor-loading-hint-bg',
  EditorLoadingWarningBg: '--theme-editor-loading-warning-bg',
  EditorLoadingWarningFg: '--theme-editor-loading-warning-fg',
  EditorTabActiveBg: '--theme-editor-tab-active-bg',
  EditorTabActiveBorder: '--theme-editor-tab-active-border',
  EditorTabActiveFg: '--theme-editor-tab-active-fg',
  EditorTabBg: '--theme-editor-tab-bg',
  EditorTabControlsFg: '--theme-editor-tab-controls-fg',
  EditorTabControlsHoverBg: '--theme-editor-tab-controls-hover-bg',
  EditorTabHoverBg: '--theme-editor-tab-hover-bg',
  EditorTitleIconBg: '--theme-editor-title-icon-bg',
  EditorTitleIconWarningBg: '--theme-editor-title-icon-warning-bg',
  EditorTitleIconWarningFg: '--theme-editor-title-icon-warning-fg',
  EditorToolbarBg: '--theme-editor-toolbar-bg',
  EditorToolbarBorder: '--theme-editor-toolbar-border',
  EditorToolbarFg: '--theme-editor-toolbar-fg',
  EditorToolbarFocusedBg: '--theme-editor-toolbar-focused-bg',
  EditorToolbarHoverBg: '--theme-editor-toolbar-hover-bg',
  EditorToolbarIcon: '--theme-editor-toolbar-icon',
  EditorToolbarIconDuotonePrimary: '--theme-editor-toolbar-icon-duotone-primary',
  EditorToolbarIconDuotoneSecondary: '--theme-editor-toolbar-icon-duotone-secondary',

  // ── Pane ──
  /** Pane body background. Used by host `.pane` and as the default iframe content background. */
  PaneBg: '--theme-pane-bg',
  PaneDivider: '--theme-pane-divider',
  PaneGroupTabHoverBg: '--theme-pane-group-tab-hover-bg',
  PaneGroupTabSelectedBg: '--theme-pane-group-tab-selected-bg',
  PaneHeaderBg: '--theme-pane-header-bg',
  PaneHeaderCollapsedBg: '--theme-pane-header-collapsed-bg',
  PaneItemBg: '--theme-pane-item-bg',
  PaneItemHoverBg: '--theme-pane-item-hover-bg',
  PaneTabActiveBg: '--theme-pane-tab-active-bg',
  PaneTabActiveFg: '--theme-pane-tab-active-fg',
  PaneTabBg: '--theme-pane-tab-bg',
  PaneTabFg: '--theme-pane-tab-fg',
  PaneTabHoverFg: '--theme-pane-tab-hover-fg',
  PaneToolbarFg: '--theme-pane-toolbar-fg',
  PaneToolbarFocusBg: '--theme-pane-toolbar-focus-bg',
  PaneToolbarFocusFg: '--theme-pane-toolbar-focus-fg',
  PaneToolbarFocusShadow: '--theme-pane-toolbar-focus-shadow',
  PaneToolbarHoverFg: '--theme-pane-toolbar-hover-fg',
  PaneToolbarLabelFg: '--theme-pane-toolbar-label-fg',

  // ── Tree ──
  TreeBg: '--theme-tree-bg',
  TreeFg: '--theme-tree-fg',
  TreeHighlightBg: '--theme-tree-highlight-bg',
  TreeHighlightFg: '--theme-tree-highlight-fg',
  TreeHoverBg: '--theme-tree-hover-bg',
  TreeIconFolder: '--theme-tree-icon-folder',
  TreeSectionBg: '--theme-tree-section-bg',
  TreeSectionFg: '--theme-tree-section-fg',
  TreeSelectedBg: '--theme-tree-selected-bg',
  TreeSelectedFg: '--theme-tree-selected-fg',

  // ── Buttons ──
  BtnDangerBg: '--theme-btn-danger-bg',
  BtnDangerBorder: '--theme-btn-danger-border',
  BtnDangerFg: '--theme-btn-danger-fg',
  BtnFg: '--theme-btn-fg',
  BtnHoverFg: '--theme-btn-hover-fg',
  BtnInfoBg: '--theme-btn-info-bg',
  BtnInfoFg: '--theme-btn-info-fg',
  BtnPrimaryBg: '--theme-btn-primary-bg',
  BtnPrimaryFg: '--theme-btn-primary-fg',
  BtnSecondaryBg: '--theme-btn-secondary-bg',
  BtnSecondaryFg: '--theme-btn-secondary-fg',
  BtnSecondaryHoverBg: '--theme-btn-secondary-hover-bg',

  // ── Dialog buttons ──
  DialogBtnDangerousBg: '--theme-dialog-btn-dangerous-bg',
  DialogBtnDangerousFg: '--theme-dialog-btn-dangerous-fg',
  DialogBtnPrimaryBg: '--theme-dialog-btn-primary-bg',
  DialogBtnPrimaryFg: '--theme-dialog-btn-primary-fg',
  DialogBtnSecondaryBg: '--theme-dialog-btn-secondary-bg',
  DialogBtnSecondaryBorder: '--theme-dialog-btn-secondary-border',
  DialogBtnSecondaryFg: '--theme-dialog-btn-secondary-fg',

  // ── Form controls ──
  /** Form control background. Used by FormInput and host form controls. */
  InputBg: '--theme-input-bg',
  InputBorder: '--theme-input-border',
  InputDisabledBg: '--theme-input-disabled-bg',
  InputDisabledFg: '--theme-input-disabled-fg',
  InputFg: '--theme-input-fg',
  InputFocusShadow: '--theme-input-focus-shadow',
  InputPlaceholder: '--theme-input-placeholder',
  SelectBg: '--theme-select-bg',
  SelectBorder: '--theme-select-border',
  SelectFg: '--theme-select-fg',

  // ── Table ──
  TableActiveBg: '--theme-table-active-bg',
  /** Table surface background. Used by plugin-authored tables and the host Table widget. */
  TableBg: '--theme-table-bg',
  TableBorder: '--theme-table-border',
  TableChildBg: '--theme-table-child-bg',
  TableFg: '--theme-table-fg',
  TableHeaderBg: '--theme-table-header-bg',
  TableHoverBg: '--theme-table-hover-bg',
  TableOptionsFg: '--theme-table-options-fg',
  TableOptionsHoverFg: '--theme-table-options-hover-fg',
  TableRowHighlightBg: '--theme-table-row-highlight-bg',
  TableRowHighlightFg: '--theme-table-row-highlight-fg',

  // ── FEEL editor (Keep component) ──
  FeelActiveLineBg: '--theme-feel-active-line-bg',
  /** FEEL editor (CodeMirror) background. Required by FeelEditor / OneLineFeelEditor. */
  FeelBg: '--theme-feel-bg',
  FeelBool: '--theme-feel-bool',
  FeelBorder: '--theme-feel-border',
  FeelComment: '--theme-feel-comment',
  FeelCursor: '--theme-feel-cursor',
  FeelFg: '--theme-feel-fg',
  FeelFocusBorder: '--theme-feel-focus-border',
  FeelFunction: '--theme-feel-function',
  FeelGutterBg: '--theme-feel-gutter-bg',
  FeelKeyword: '--theme-feel-keyword',
  FeelNumber: '--theme-feel-number',
  FeelSelectionBg: '--theme-feel-selection-bg',
  FeelString: '--theme-feel-string',
  FeelTooltipBg: '--theme-feel-tooltip-bg',
  FeelTooltipBorder: '--theme-feel-tooltip-border',
  FeelTooltipFg: '--theme-feel-tooltip-fg',
  FeelTooltipSelectedBg: '--theme-feel-tooltip-selected-bg',
  FeelTooltipSelectedFg: '--theme-feel-tooltip-selected-fg',
  FeelVariable: '--theme-feel-variable',

  // ── Quick jump ──
  QuickJumpBadgeFg: '--theme-quick-jump-badge-fg',
  QuickJumpBg: '--theme-quick-jump-bg',
  QuickJumpBorder: '--theme-quick-jump-border',
  QuickJumpEntryFg: '--theme-quick-jump-entry-fg',
  QuickJumpFocusShadow: '--theme-quick-jump-focus-shadow',
  QuickJumpFocusedBg: '--theme-quick-jump-focused-bg',
  QuickJumpFocusedFg: '--theme-quick-jump-focused-fg',
  QuickJumpHoverBg: '--theme-quick-jump-hover-bg',
  QuickJumpHoverFg: '--theme-quick-jump-hover-fg',
  QuickJumpInputBg: '--theme-quick-jump-input-bg',
  QuickJumpInputBorder: '--theme-quick-jump-input-border',
  QuickJumpInputFg: '--theme-quick-jump-input-fg',
  QuickJumpShadow: '--theme-quick-jump-shadow',

  // ── Modal / dialog ──
  ModalBg: '--theme-modal-bg',
  ModalBorder: '--theme-modal-border',
  ModalCloseFg: '--theme-modal-close-fg',
  ModalFg: '--theme-modal-fg',

  // ── Dropdown ──
  DropdownBg: '--theme-dropdown-bg',
  DropdownDisabledFg: '--theme-dropdown-disabled-fg',
  DropdownDivider: '--theme-dropdown-divider',
  DropdownFg: '--theme-dropdown-fg',
  DropdownHoverBg: '--theme-dropdown-hover-bg',
  DropdownItemFg: '--theme-dropdown-item-fg',
  DropdownItemHoverFg: '--theme-dropdown-item-hover-fg',

  // ── Context menu ──
  /** Presentational context-menu background (host and iframe). */
  ContextMenuBg: '--theme-context-menu-bg',
  ContextMenuBorder: '--theme-context-menu-border',
  ContextMenuDisabledFg: '--theme-context-menu-disabled-fg',
  ContextMenuFg: '--theme-context-menu-fg',
  ContextMenuHoverBg: '--theme-context-menu-hover-bg',
  ContextMenuHoverFg: '--theme-context-menu-hover-fg',
  ContextMenuIconFg: '--theme-context-menu-icon-fg',
  ContextMenuSeparator: '--theme-context-menu-separator',

  // ── Notification ──
  NotificationBg: '--theme-notification-bg',
  NotificationCloseFg: '--theme-notification-close-fg',
  NotificationContainerBg: '--theme-notification-container-bg',
  NotificationHeaderBg: '--theme-notification-header-bg',
  NotificationHeaderFg: '--theme-notification-header-fg',
  NotificationOptionIconFg: '--theme-notification-option-icon-fg',

  // ── Card ──
  CardBg: '--theme-card-bg',
  CardBorder: '--theme-card-border',
  CardFooterBg: '--theme-card-footer-bg',

  // ── Start page ──
  StartpageFlavorFg: '--theme-startpage-flavor-fg',
  StartpageHeroBorder: '--theme-startpage-hero-border',
  StartpageHeroHoverBg: '--theme-startpage-hero-hover-bg',
  StartpageHeroHoverBorder: '--theme-startpage-hero-hover-border',
  StartpageHeroIconBg: '--theme-startpage-hero-icon-bg',
  StartpageSeparator: '--theme-startpage-separator',

  // ── Keystroke ──
  KeystrokeBg: '--theme-keystroke-bg',
  KeystrokeFg: '--theme-keystroke-fg',

  // ── Validation ──
  ValidationErrorBg: '--theme-validation-error-bg',
  ValidationErrorBorder: '--theme-validation-error-border',
  ValidationErrorFg: '--theme-validation-error-fg',
  ValidationErrorShadow: '--theme-validation-error-shadow',
  ValidationSuccessFg: '--theme-validation-success-fg',

  // ── React Select ──
  ReactSelectControlBg: '--theme-react-select-control-bg',
  ReactSelectControlBorder: '--theme-react-select-control-border',
  ReactSelectMenuBg: '--theme-react-select-menu-bg',
  ReactSelectMenuBorder: '--theme-react-select-menu-border',
  ReactSelectOptionFocusedBg: '--theme-react-select-option-focused-bg',
  ReactSelectOptionSelectedBg: '--theme-react-select-option-selected-bg',
  ReactSelectValueFg: '--theme-react-select-value-fg',

  // ── Editors / calendar ──
  CalendarColorScheme: '--theme-calendar-color-scheme',
  CalendarPickerBg: '--theme-calendar-picker-bg',
  CalendarPickerBorder: '--theme-calendar-picker-border',
  CalendarPickerFg: '--theme-calendar-picker-fg',
  CanvasEditingBg: '--theme-canvas-editing-bg',
  OneLineEditorBorder: '--theme-one-line-editor-border',

  // ── Runtime hint ──
  RuntimeHintBorder: '--theme-runtime-hint-border',
  RuntimeHintFg: '--theme-runtime-hint-fg',
  RuntimeHintHoverBorder: '--theme-runtime-hint-hover-border',
  RuntimeHintHoverFg: '--theme-runtime-hint-hover-fg',

  // ── Open-in-new-tab ──
  OpenTabFg: '--theme-open-tab-fg',
  OpenTabHoverFg: '--theme-open-tab-hover-fg',

  // ── Icons ──
  SquaredIconBg: '--theme-squared-icon-bg',
  StackedIconShadow: '--theme-stacked-icon-shadow',

  // ── Inline search ──
  InlineSearchBg: '--theme-inline-search-bg',
  InlineSearchBtnActiveBg: '--theme-inline-search-btn-active-bg',
  InlineSearchBtnHoverBg: '--theme-inline-search-btn-hover-bg',
  InlineSearchInputBg: '--theme-inline-search-input-bg',
  InlineSearchInputFocusShadow: '--theme-inline-search-input-focus-shadow',

  // ── Error boundary ──
  ErrorBoundaryBg: '--theme-error-boundary-bg',
  ErrorBoundaryFg: '--theme-error-boundary-fg',

  // ── Dev indicator ──
  TodoGradientEnd: '--theme-todo-gradient-end',
  TodoGradientStart: '--theme-todo-gradient-start',
  TodoOverlayBg: '--theme-todo-overlay-bg',
  TodoOverlayFg: '--theme-todo-overlay-fg',

  // ── Tabs overflow ──
  TabsOverflowBg: '--theme-tabs-overflow-bg',

  // ── Search results ──
  SearchResultBg: '--theme-search-result-bg',
  SearchResultHighlightBg: '--theme-search-result-highlight-bg',
  SearchResultHighlightBorder: '--theme-search-result-highlight-border',

  // ── Misc ──
  HighlightBg: '--theme-highlight-bg',
  LayerBg: '--theme-layer-bg',
  ListGroupBg: '--theme-list-group-bg',
  ListGroupFg: '--theme-list-group-fg',
  PreBg: '--theme-pre-bg',
  PreFg: '--theme-pre-fg',
  RecentFileBg: '--theme-recent-file-bg',

  // ── BPMN diagram ──
  DiagramBendpointFill: '--theme-diagram-bendpoint-fill',
  DiagramBendpointHoverFill: '--theme-diagram-bendpoint-hover-fill',
  DiagramBendpointStroke: '--theme-diagram-bendpoint-stroke',
  DiagramBg: '--theme-diagram-bg',
  DiagramConnectOkFill: '--theme-diagram-connect-ok-fill',
  DiagramContextPadBg: '--theme-diagram-context-pad-bg',
  DiagramContextPadHoverBg: '--theme-diagram-context-pad-hover-bg',
  DiagramDirectEditingBg: '--theme-diagram-direct-editing-bg',
  DiagramDirectEditingBorder: '--theme-diagram-direct-editing-border',
  DiagramFg: '--theme-diagram-fg',
  DiagramHoverOutline: '--theme-diagram-hover-outline',
  DiagramInputBg: '--theme-diagram-input-bg',
  DiagramInputFg: '--theme-diagram-input-fg',
  DiagramMinimapBg: '--theme-diagram-minimap-bg',
  DiagramMinimapOverlayBg: '--theme-diagram-minimap-overlay-bg',
  DiagramPaletteBg: '--theme-diagram-palette-bg',
  DiagramPaletteBorder: '--theme-diagram-palette-border',
  DiagramPopupBg: '--theme-diagram-popup-bg',
  DiagramPopupSelectedBg: '--theme-diagram-popup-selected-bg',
  DiagramPopupShadow: '--theme-diagram-popup-shadow',
  DiagramSegmentDraggerFill: '--theme-diagram-segment-dragger-fill',
  DiagramSegmentDraggerStroke: '--theme-diagram-segment-dragger-stroke',
  DiagramSelectedOutline: '--theme-diagram-selected-outline',

  // ── Color picker ──
  ColorPickerBg: '--theme-color-picker-bg',
  ColorPickerBorder: '--theme-color-picker-border',
  ColorPickerOptionBorder: '--theme-color-picker-option-border',
  ColorPickerOptionHoverShadow: '--theme-color-picker-option-hover-shadow',
  ColorPickerShadow: '--theme-color-picker-shadow',

  // ── DMN editor ──
  DmnAccent: '--theme-dmn-accent',
  DmnAccent30: '--theme-dmn-accent-30',
  DmnAccentDeep: '--theme-dmn-accent-deep',
  DmnAccentGlow: '--theme-dmn-accent-glow',
  DmnAccentHover: '--theme-dmn-accent-hover',
  DmnAccentSubtle: '--theme-dmn-accent-subtle',
  DmnBg: '--theme-dmn-bg',
  DmnBlack: '--theme-dmn-black',
  DmnBorder: '--theme-dmn-border',
  DmnBorderSubtle: '--theme-dmn-border-subtle',
  DmnDrilldownActiveBg: '--theme-dmn-drilldown-active-bg',
  DmnDrilldownActiveFg: '--theme-dmn-drilldown-active-fg',
  DmnDrilldownHoverBg: '--theme-dmn-drilldown-hover-bg',
  DmnFg: '--theme-dmn-fg',
  DmnFgFaint: '--theme-dmn-fg-faint',
  DmnFgMuted: '--theme-dmn-fg-muted',
  DmnGreen: '--theme-dmn-green',
  DmnRed: '--theme-dmn-red',
  DmnRedDeep: '--theme-dmn-red-deep',
  DmnRedGlow: '--theme-dmn-red-glow',
  DmnRedSubtle: '--theme-dmn-red-subtle',
  DmnShadowLight: '--theme-dmn-shadow-light',
  DmnShadowMedium: '--theme-dmn-shadow-medium',
  DmnSurface: '--theme-dmn-surface',
  DmnSurfaceAlt: '--theme-dmn-surface-alt',

  // ── Engine workspace ──
  EngineWsBadgeAbortedBg: '--theme-engine-ws-badge-aborted-bg',
  EngineWsBadgeAbortedFg: '--theme-engine-ws-badge-aborted-fg',
  EngineWsBadgeCancelledBg: '--theme-engine-ws-badge-cancelled-bg',
  EngineWsBadgeCancelledFg: '--theme-engine-ws-badge-cancelled-fg',
  EngineWsBadgeCompensatedBg: '--theme-engine-ws-badge-compensated-bg',
  EngineWsBadgeCompensatedFg: '--theme-engine-ws-badge-compensated-fg',
  EngineWsBadgeErrorBg: '--theme-engine-ws-badge-error-bg',
  EngineWsBadgeErrorFg: '--theme-engine-ws-badge-error-fg',
  EngineWsBadgeEscalatedBg: '--theme-engine-ws-badge-escalated-bg',
  EngineWsBadgeEscalatedFg: '--theme-engine-ws-badge-escalated-fg',
  EngineWsBadgeFatalBg: '--theme-engine-ws-badge-fatal-bg',
  EngineWsBadgeFatalFg: '--theme-engine-ws-badge-fatal-fg',
  EngineWsBadgeFinishedBg: '--theme-engine-ws-badge-finished-bg',
  EngineWsBadgeFinishedFg: '--theme-engine-ws-badge-finished-fg',
  EngineWsBadgeRunningBg: '--theme-engine-ws-badge-running-bg',
  EngineWsBadgeRunningFg: '--theme-engine-ws-badge-running-fg',
  EngineWsHealthCriticalBg: '--theme-engine-ws-health-critical-bg',
  EngineWsHealthCriticalFg: '--theme-engine-ws-health-critical-fg',
  EngineWsHealthOkBg: '--theme-engine-ws-health-ok-bg',
  EngineWsHealthOkFg: '--theme-engine-ws-health-ok-fg',
  EngineWsHealthUnknownBg: '--theme-engine-ws-health-unknown-bg',
  EngineWsHealthUnknownFg: '--theme-engine-ws-health-unknown-fg',
  EngineWsHealthWarnBg: '--theme-engine-ws-health-warn-bg',
  EngineWsHealthWarnFg: '--theme-engine-ws-health-warn-fg',
  EngineWsSidebarAddHoverBg: '--theme-engine-ws-sidebar-add-hover-bg',
  EngineWsStatusDisabledBg: '--theme-engine-ws-status-disabled-bg',
  EngineWsStatusDisabledFg: '--theme-engine-ws-status-disabled-fg',
  EngineWsStatusEnabledBg: '--theme-engine-ws-status-enabled-bg',
  EngineWsStatusEnabledFg: '--theme-engine-ws-status-enabled-fg',

  // ── Git status ──
  GitAdded: '--theme-git-added',
  GitConflicted: '--theme-git-conflicted',
  GitDeleted: '--theme-git-deleted',
  GitIgnored: '--theme-git-ignored',
  GitModified: '--theme-git-modified',
  GitRenamed: '--theme-git-renamed',
  GitUntracked: '--theme-git-untracked',

  // ── Diff viewer ──
  DiffAddedBg: '--theme-diff-added-bg',
  DiffAddedHighlight: '--theme-diff-added-highlight',
  DiffButtonActiveFg: '--theme-diff-button-active-fg',
  DiffButtonBg: '--theme-diff-button-bg',
  DiffButtonFg: '--theme-diff-button-fg',
  DiffLineNumberFg: '--theme-diff-line-number-fg',
  DiffOverlayAddedBg: '--theme-diff-overlay-added-bg',
  DiffOverlayDeletedBg: '--theme-diff-overlay-deleted-bg',
  DiffOverlayMovedBg: '--theme-diff-overlay-moved-bg',
  DiffOverlayUpdatedBg: '--theme-diff-overlay-updated-bg',
  DiffRemovedBg: '--theme-diff-removed-bg',
  DiffRemovedHighlight: '--theme-diff-removed-highlight',
  DiffSplitter: '--theme-diff-splitter',
  DiffSplitterBorder: '--theme-diff-splitter-border',
  DiffSvgAdded: '--theme-diff-svg-added',
  DiffSvgRemoved: '--theme-diff-svg-removed',
  DiffTitleBg: '--theme-diff-title-bg',
  DiffTitleFg: '--theme-diff-title-fg',

  // ── Merge ──
  MergeAutoForeground: '--theme-merge-auto-foreground',
  MergeConflictBackground: '--theme-merge-conflict-background',
  MergeConflictForeground: '--theme-merge-conflict-foreground',
  MergeOursBackground: '--theme-merge-ours-background',
  MergeOursForeground: '--theme-merge-ours-foreground',
  MergeResultBackground: '--theme-merge-result-background',
  MergeResultForeground: '--theme-merge-result-foreground',
  MergeTheirsBackground: '--theme-merge-theirs-background',
  MergeTheirsForeground: '--theme-merge-theirs-foreground',

  // ── Markdown editor ──
  MdxBg: '--theme-mdx-bg',
  MdxDialogBg: '--theme-mdx-dialog-bg',
  MdxListboxHoverBg: '--theme-mdx-listbox-hover-bg',
  MdxListboxSelectedBg: '--theme-mdx-listbox-selected-bg',
  MdxListboxSelectedFg: '--theme-mdx-listbox-selected-fg',
  MdxText: '--theme-mdx-text',
} as const;

export type ThemeTokenName = (typeof ThemeToken)[keyof typeof ThemeToken];
