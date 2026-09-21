# Studio Architecture (Detail)

This folder contains detailed architecture documentation for the Studio. It complements the existing high-level docs (`systeme.md`, `philosophie.md`) with concrete, technical knowledge: file paths, type signatures, event flows, and subsystem relationships.

Plugin **how-to** is [plugin-development-guide.md](../plugin-development-guide.md). Recurring constraints: [common-pitfalls.md](common-pitfalls.md).

Each file owns one topic. Point to other files; do not copy their tables.

## Topics

- **[workspace.md](workspace.md)** — Solutions, projects, file handling, file explorer, search/symbol index, session restore, window management
- **[commands.md](commands.md)** — Command system: CommandManager, CommandMediator, type definitions, execution flow, cross-module patterns, command listings
- **[modules.md](modules.md)** — Internal module catalog, entry points, dependency graph, load order, loading mechanism
- **[engine.md](engine.md)** — Engine connectivity: EngineConnectionManager, five engine modules (core, workspace, model-viewer, decision-viewer, debugger), commands, authentication, document URI scheme
- **[dialogs.md](dialogs.md)** — Dialog system: DialogManager queue, DialogService/DialogServiceElectron, custom dialog rendering pipeline, all 13 content types, validation, native file pickers, CSS
- **[editor-documents.md](editor-documents.md)** — Editor Document system: type registration, EditorDocumentModel base class, renderer/inspector contracts, model-to-renderer communication, subscription best practices
- **[build.md](build.md)** — Build system: Rspack configuration, build targets, loaders, workers, conditional compilation, production builds
- **[icons.md](icons.md)** — Icon system: Phosphor Icons integration, IconMediator, CSS class format, duotone coloring, custom utility classes, SVG composites
- **[theming.md](theming.md)** — Theming system: semantic CSS tokens, ThemeManager/ThemeMediator, theme registration and inheritance, module token ownership, developer rules
- **[notifications.md](notifications.md)** — Notification system: NotificationManager, open/close/toggle/update API, notification types, rendering pipeline, dismissal behavior, status bar integration
- **[tree.md](tree.md)** — Tree component system: Tree, TreeDataAdapter, HeadlessTreeItem, studioTreePlugin, TreeViewMediator, pathId identity, consumer integration
- **[settings.md](settings.md)** — Settings system: SettingsManager/SettingsMediator, localStorage persistence, JSON format, key conventions, default registration, value types, User/Default Settings editors
- **[bpmn-modeler-modules.md](bpmn-modeler-modules.md)** — BPMN modeler module discovery: BpmnModelerModuleRegistry, registration command, diagram-js module format, modeler adapter SDK access
- **[bpmn-token-simulator.md](bpmn-token-simulator.md)** — BPMN token flow simulator: engine/visual/control layers, bridge pattern, theme integration, supported BPMN elements
- **[panes.md](panes.md)** — Pane system: PaneProvider contract, `shouldBeDisplayed` vs renderer split, PaneWrapper gating, registration, data access from EditorDocumentModel
- **[bpmn-editor-properties.md](bpmn-editor-properties.md)** — BPMN property pane inventory (property / scripting / documentation). PaneProvider contract: [panes.md](panes.md). FEEL widgets: [feel-editor.md](feel-editor.md). DMN panes: [dmn-editor.md](dmn-editor.md).
- **[bpmn-drilldown.md](bpmn-drilldown.md)** — Subprocess drill-down: plane navigation, root.set event wiring, plane-scoped element access, breadcrumb theming, metadata persistence, PropertiesSubprocessContext pane, DrilldownBehavior module, drill-down/drill-up commands
- **[bpmn-linter.md](bpmn-linter.md)** — BPMN linter module: bpmnlint integration, LintBridge/LintEngine, canvas markers, Error Summary Badge, Findings Pane toggle, rule profiles, three-tier findings
- **[bpmn-sanitizer.md](bpmn-sanitizer.md)** — BPMN sanitizer: always-on structural integrity scanner, ghost element / dangling reference / empty container detection, SanitizerBridge diagram-js module, canvas badge, Inspector section, per-issue and bulk fixes
- **[workbench-layout.md](workbench-layout.md)** — Workbench layout: three-column split-bar model, MenuBarSection, PaneContentToggle, PaneManager pane area selection, left menu bar interaction model
- **[imports-and-modules.md](imports-and-modules.md)** — Module resolution: subpath import aliases (`#bifrost/*`, `#components/*`, `#modules/*`), ambient declarations, TypeScript 6.0 configuration, per-target tsconfig layout
- **[bpmn-diff.md](bpmn-diff.md)** — Side-by-side BPMN diff, history preview, change summary, three-panel merge UI
- **[git-cruiser.md](git-cruiser.md)** — Git primitives: GitService, IPC, pane, status bar, merge framework (BPMN/DMN visualization in bpmn-diff)
- **[code-quality.md](code-quality.md)** — Code quality: ESLint flat config, Prettier setup, React Compiler rules, common patterns, suppression conventions, verification scripts
- **[status-bar.md](status-bar.md)** — Status bar infrastructure: priority-based ordering, progress indicators, solution badge, encoding/line-ending items, diagnostics service and problems count
- **[table.md](table.md)** — Host Table widget around TanStack Table v9: column definitions, pagination, column-header filters, theming tokens
- **[plugin-host.md](plugin-host.md)** — Process-isolated Plugin Host: `PluginService`, SES workers, permissions, quarantine, PH protocol, management UI
- **[webviews.md](webviews.md)** — Plugin iframes: `bifrostfw-webview://`, postMessage bridge, editor/pane surfaces, CSP
- **[feel-editor.md](feel-editor.md)** — FEEL expression editor: CodeMirror 6 components (`FeelEditor`, `OneLineFeelEditor`), theming tokens, FEEL context command, variable structure, dependency chain
- **[code-editors.md](code-editors.md)** — Host CodeMirror 6 wrappers (`MultiLineCodeEditor`, `DiffEditor`), shared kit, language map, Settings `json5Schema`, rainbow brackets, test selectors
- **[plugin-manifest.md](plugin-manifest.md)** — `bifrostStudio` schema: contributions, activation events, permissions (`filesystem`, `commands.*`, `bpmn` / `bpmn.modelling` / `bpmn.renderer`, same for `dmn`; `renderer-modules` is a legacy alias of `bpmn.renderer`)
- **[dmn-editor.md](dmn-editor.md)** — DMN editor module system: three-module split (dmn-core/dmn-editor/dmn-diff), DmnModelerComponentAdapter, multi-view architecture, property panes, search indexing, validation, diff engine, merge resolver, SDK types, FEEL context, dmn-js integration
- **[startpage.md](startpage.md)** — Start page (Welcome tab): layout, hero/action card grids, contribution API (`StartpageCardDescriptor`), theme tokens, flavor text, settings, test attributes
- **[plugin-bpmn-enrichment.md](plugin-bpmn-enrichment.md)** — Plugin BPMN editor enrichment: tiered permission model (bpmn → bpmn.modelling → bpmn.renderer), overlay API (badge/icon/action/status), palette/context pad contributions (manifest + runtime, dynamic elementIds), modeling API, renderer module injection (PluginChannel, PluginModuleLoader, force-reopen), security model
- **[plugin-dmn-enrichment.md](plugin-dmn-enrichment.md)** — Plugin DMN editor enrichment: DRD-only scope, tiered permission model (dmn → dmn.modelling → dmn.renderer), `DmnPluginOverlayManager` factory-chain + direct rendering, palette/context pad contributions (manifest + runtime, dynamic elementIds), modeling API (`createElement` absolute + `appendElement` relative), renderer module injection, view-aware overlay clearing, security model
- **[common-pitfalls.md](common-pitfalls.md)** — Recurring constraints only (not test postmortems). See also [plugin-development-guide.md](../plugin-development-guide.md)
