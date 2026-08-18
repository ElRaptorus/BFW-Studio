# Modules

---

## Overview

The Studio follows an "eat your own dogfood" principle: its core functionality is delivered through modules. All internal modules are packaged with the application and located in `studio/src/modules/`. They have direct access to internal APIs without compatibility guarantees.

> **Note (2026-05-12):** The legacy external extension mechanism has been removed. Previously, user-developed extensions could be loaded from `~/.evil/studio/extensions/` at runtime. This mechanism relied on `eval()`-based code loading and a fragile `window` bridge for sharing React and other framework singletons — both fundamentally broken approaches. A proper module mechanism with process isolation, declarative manifests, and framework-agnostic webview UI is being developed. See [`docs/extensions-v2/extension-v2-roadmap.md`](../extensions-v2/extension-v2-roadmap.md) for the roadmap.

> **External plugins** are now handled by the Plugin Host — a per-window, process-isolated Node.js child process managed by the renderer. Plugins run in their own process, communicate via a typed message protocol, and have no access to the DOM or Electron APIs. See [`plugin-host.md`](plugin-host.md) for the full architecture.

## Loading Mechanism

**Loader:** `studio/src/bifrost/common/ModuleManager.ts`
**Orchestrator:** `studio/src/bifrost/browser/ModuleMediator.ts`
**Load site:** `studio/src/createAndInitializeBifrost.ts`

Modules are loaded sequentially via `bifrost.modules.requirePackagedModule(name)`, which calls `require('../../modules/${name}/index')` and invokes the exported `onLoad(bifrost)` function. Each module receives the full `Bifrost` instance.

## Load Order

The load order is explicit and defined in `studio/src/createAndInitializeBifrost.ts`:

```
 1. std                    (includes settings, help, aboutpage, startpage)
 2. themes                 (registers 10 extra themes)
 3. bpmn-core
 4. bpmn-editor
 5. bpmn-token-simulator
 6. bpmn-linter
 7. bpmn-diff
 8. dmn-core
 9. dmn-editor
10. dmn-diff
11. git-cruiser
12. machine-sanctum
13. engine-core            (registers EngineConnectionManager shared resource)
14. engine-workspace       (sidebar, catalogs, menubar/run controls)
15. engine-model-viewer    (read-only deployed BPMN viewer)
16. engine-decision-viewer (read-only deployed DMN viewer)
17. engine-debugger        (live PI debugger)
18. plugins
```

This order respects the dependency graph: `std` first (it bundles all foundational UI — settings, help, about page, start page), `themes` second (registers extra themes after `std` has registered the defaults), then BPMN infrastructure (`bpmn-core` before `bpmn-editor`), then DMN infrastructure (`dmn-core` before `dmn-editor`), then `git-cruiser` (so it can detect registered diff commands), then engine modules (`engine-core` first as foundation, then workspace/viewers/debugger), then plugin management (`plugins`) last.

## Module Catalog

### Foundation

#### std

The cornerstone module. Provides commands, menus, panes, keybindings, editor management, and the visual framework that makes the Studio a functional application. Contains several sub-features that are loaded during `onLoad` via dedicated loader functions:

| Sub-feature | Loader | Path | Purpose |
|-------------|--------|------|---------|
| settings | `loadSettings()` | `studio/src/modules/std/settings/index.ts` | Settings GUI, JSON editor, default settings viewer, key bindings editor |
| help | `loadHelp()` | `studio/src/modules/std/help/index.ts` | Help text document type and rendering |
| aboutpage | `loadAboutPage()` | `studio/src/modules/std/aboutpage/index.ts` | About page |
| startpage | `loadStartPage()` | `studio/src/modules/std/startpage/index.ts` | Welcome / start page |

- **Entry:** `studio/src/modules/std/index.ts`
- **Dependencies:** None
- **Depended on by:** Nearly all other modules (via `std.*` commands, `std.help.open`, `std.settings.openUserSettingsAtCategory`)

#### themes

Registers ten additional color themes beyond the two core themes (`light`/`dark`) provided by `std`. Includes Forge World Day/Night, The Dark City, Tomb World, Fenris, Medusa, VS Code Light/Dark, and Zed Light/Dark. Each theme is defined as a fully self-contained SCSS file with all core and module-specific tokens merged in.

- **Entry:** `studio/src/modules/themes/index.ts`
- **Dependencies:** None
- **Depended on by:** None

### BPMN

#### bpmn-core

Shared BPMN infrastructure. Contains the bpmn-js modeler/viewer adapter, overlay factories, export functions, BPMN-specific solution/project types, the context pad provider, and the modeler module discovery registry.

- **Entry:** `studio/src/modules/bpmn-core/index.tsx`
- **Commands registered:** `bpmn.modeler.registerModule` (allows modules to inject diagram-js modules into every BpmnModeler instance)
- **Dependencies:** None
- **Depended on by:** `bpmn-editor`, `engine-model-viewer`, `engine-debugger` (via direct imports); `engine-workspace` (moddle descriptor only); any module that calls `bpmn.modeler.registerModule` (via command)

#### bpmn-editor

The primary BPMN 2.0 process model editor. Provides the interactive modeler, property panels, fragment renderers, and all editing functionality. Property panes are structured into three groups (`property`, `scripting`, `documentation`) on the right pane area. Uses BPMN 2.0 spec-compliant data model — service tasks use the `implementation` attribute, loops use `StandardLoopCharacteristics` / `MultiInstanceLoopCharacteristics`, user task assignees use `HumanPerformer` / `PotentialOwner` resource roles. See `bpmn-editor-properties.md` for full pane architecture.

- **Entry:** `studio/src/modules/bpmn-editor/index.tsx`
- **Dependencies (commands):** `std` (incl. `std.help.open`), `bpmn-diff`
- **Dependencies (imports):** `bpmn-core`
- **Depended on by:** `engine-workspace/initializeRunMenu` (via imports)

#### bpmn-diff

Diff view for comparing two BPMN process models side by side.

- **Entry:** `studio/src/modules/bpmn-diff/index.ts`
- **Dependencies (commands):** `bpmn-editor` (via `bpmn.diagram.resetRelevantIds`)

### DMN Editing

#### dmn-core

Shared DMN infrastructure: `DmnModelerComponentAdapter` wrapping `dmn-js`, DMN diff engine (XML structural comparison), moddle extensions, custom command handlers, shared types.

- **Entry:** `studio/src/modules/dmn-core/index.ts`
- **Commands registered:** `dmn.modeler.registerModule`
- **Dependencies:** None
- **Depended on by:** `dmn-editor`, `dmn-diff` (via direct imports)

#### dmn-editor

The DMN 1.5 decision model editor. Provides the interactive DRD modeler, decision table editor, literal expression editor, boxed expression editor, property panels, merge resolver, and all editing functionality. Mirrors the `bpmn-editor` module structure.

- **Entry:** `studio/src/modules/dmn-editor/index.ts`
- **Dependencies (imports):** `dmn-core`
- **Document types registered:** `dmn` (`.dmn` files)
- **Merge resolver:** `DmnMergeResolver` + `DmnMergeResultModeler` (per-element resolution via three-panel DRD layout and `dmnXmlMergeEngine`)

#### dmn-diff

Diff view for comparing two DMN decision models side by side. Structural comparison at the DRG element level with diff overlays on DRD viewers.

- **Entry:** `studio/src/modules/dmn-diff/index.ts`
- **Dependencies (imports):** `dmn-core/diff`
- **Document types registered:** `dmn.diff` (`fragment+dmn.diff:` URIs), `dmn.history-preview` (`fragment+dmn.history-preview:` URIs)

### Git Integration

#### git-cruiser

Full Git integration for Evil Studio. Detects repos, visualizes file status, provides Git operations via a dedicated pane, context menus, status bar, and diagram-specific features (BPMN and DMN).

- **Entry:** `studio/src/modules/git-cruiser/index.ts`
- **Dependencies (commands):** `bpmn-diff` (via `bpmn.diff.openDiffTwoFiles`), `dmn-diff` (via `dmn.diff.openDiffTwoFiles`)
- **Dependencies (npm):** `simple-git` (main process)
- **Architecture doc:** [git-cruiser.md](git-cruiser.md)

### Engine

All engine modules interact with an external ThomasTheDaemonEngine instance via `@elraptorus/daemonengine_client`. The engine is not part of this application. Connectivity is managed through `EngineConnectionManager`, a shared resource registered by `engine-core` and consumed by all other engine modules via `bifrost.getSharedRessource('engineConnectionManager')`.

#### engine-core

Foundation layer for all engine UI. Provides multi-engine connection management (`EngineConnectionManager`), JWT auth (`JwtIdentityManager`), WebSocket event bridge, shared formatters/components, a frozen command contract (`ENGINE_COMMANDS`), and settings keys used across all engine modules.

- **Entry:** `studio/src/modules/engine-core/index.ts`
- **Dependencies (commands):** `std`
- **Dependencies (npm):** `@elraptorus/daemonengine_client`, `@elraptorus/daemonengine_sdk`
- **Shared resources registered:** `engineConnectionManager`, `engineWebSocketBridge`
- **Depended on by:** `engine-workspace`, `engine-model-viewer`, `engine-decision-viewer`, `engine-debugger`
- **Commands registered:** `engine.connect`, `engine.connectWithDialog`, `engine.disconnect`, `engine.removeFromHistory`, `engine.setAuthToken`, `engine.deploy`, `engine.deployBatch`, `engine.startProcess`, `engine.abortProcessInstance`, `engine.retryProcessInstance`, `engine.deleteProcessInstance`, `engine.configuredStartProcess`, `engine.startProcessAndOpenDebugger`, `engine.configuredStartProcessAndOpenDebugger`, `engine.triggerMessage`, `engine.triggerSignal`

#### engine-workspace

Operational hub for connected engines. Provides the left-sidebar engine navigation pane, six workspace document types (dashboard, process explorer, instance search, task inbox, decision catalog, timer schedules), deploy-from-explorer context menus, and the engine menubar (deploy/start/play controls in `initializeRunMenu.ts`). Replaces the former `engine-browser` module.

- **Entry:** `studio/src/modules/engine-workspace/index.ts`
- **Dependencies (commands):** `std`, `engine-core`
- **Dependencies (imports):** `engine-core`, `bpmn-core` (moddle descriptor)
- **Document types registered:** `engine-dashboard`, `engine-process-explorer`, `engine-instance-search`, `engine-task-inbox`, `engine-decision-catalog`, `engine-timer-schedules`
- **Panes registered:** `EngineSidebarPane` (left), `ProcessModelInfoPane`, `ProcessInstanceSummaryPane`, `TaskDetailPane`, `DecisionSummaryPane`, `ScheduleDetailPane` (right/property)
- **Shared resources registered:** `engine-workspace.taskInbox.pendingCounts` (via `TaskCountPoller`)
- **Depended on by:** `engine-debugger` (via commands)

#### engine-model-viewer

Read-only viewer for deployed BPMN process definitions fetched from the engine. Shows version history, element property panes, start-from-start-event overlays, and export. Replaces the former `engine-bpmn-viewer` module.

- **Entry:** `studio/src/modules/engine-model-viewer/index.ts`
- **Dependencies (commands):** `std`, `engine-core`
- **Dependencies (imports):** `engine-core`, `bpmn-core` (viewer adapter, overlay manager, SVG export)
- **Document types registered:** `engine-model-viewer` (URI: `engine-model://{engineId}/{processModelId}`)
- **Panes registered:** 22 property panes, 5 scripting panes, 1 documentation pane (right area)
- **Depended on by:** (none currently)

#### engine-decision-viewer

Read-only DRD viewer for deployed DMN decision definitions, with ad-hoc evaluation panel, version switching, and element-level property panes.

- **Entry:** `studio/src/modules/engine-decision-viewer/index.ts`
- **Dependencies (commands):** `std`, `engine-core`
- **Dependencies (imports):** `engine-core`, `dmn-core` (viewer adapter)
- **Document types registered:** `engine-decision-viewer` (URI: `engine-decision://{engineId}/{decisionModelId}`)
- **Panes registered:** `DefinitionInfoPane`, `DecisionDetailPane`, `DecisionTableDetailPane`, `LiteralExpressionPane`, `BkmDetailPane`, `ItemDefinitionDetailPane`, `DecisionServiceDetailPane` (right/property)
- **Depended on by:** `engine-debugger` (types import for DMN trace UI)

#### engine-debugger

Live process instance debugger. Provides BPMN diagram with runtime overlays, PI/FNI property panels, bottom inspector (expression runner, event log), user task form viewer, and DMN trace drill-down for Business Rule Task executions.

- **Entry:** `studio/src/modules/engine-debugger/index.tsx`
- **Dependencies (commands):** `std`, `engine-core`, `engine-workspace`
- **Dependencies (imports):** `engine-core`, `bpmn-core` (viewer adapter, overlays, SVG export), `dmn-core` (DMN trace renderer), `engine-decision-viewer` (types only)
- **Document types registered:** `engine-debugger`, `engine-debug.user-task-view`, `engine-debugger.json-property`, `engine-debugger.process-json-property`, `engine-debugger.docs`, `engine-debugger.inspector-item`, `engine-debug.dmn-trace`
- **Panes registered:** ~60+ property/dataflow/scripting panes (right area)
- **Depended on by:** (none currently)

#### bpmn-token-simulator

Studio-native BPMN token flow simulator. Visualizes token movement through process diagrams with auto/step modes, exclusive/parallel gateway support, and theme-aware styling. First consumer of the modeler module discovery mechanism.

- **Entry:** `studio/src/modules/bpmn-token-simulator/index.ts`
- **Commands registered:** `bpmn.tokenSimulation.toggle`
- **Dependencies (commands):** `bpmn-core` (via `bpmn.modeler.registerModule`)
- **Dependencies (SDK types):** `@evil/bifrost_fw_sdk` (BpmnDocumentModel, BpmnModelerComponentAdapter)
- **Dependencies (imports):** None (fully decoupled)

#### bpmn-linter

BPMN diagram linter using bpmnlint as the rule engine. Provides auto/manual lint triggering, canvas markers, an Error Summary Badge, a Problems Pane (in its own `linter` pane group on the right area), and a ruleset selector in the menu bar. Feeds findings to `bifrost.diagnostics` for the status bar problems count.

- **Entry:** `studio/src/modules/bpmn-linter/index.ts`
- **Commands registered:** `bpmn.linter.toggle`, `bpmn.linter.showProblemsPane`, `bpmn.linter.setProfile`, `bpmn.linter.createCustomRuleset`
- **Dependencies (commands):** `bpmn-core` (via `bpmn.modeler.registerModule`)
- **Dependencies (SDK types):** `@evil/bifrost_fw_sdk` (BpmnDocumentModel, PaneProvider, PaneComponentProps)
- **Dependencies (imports):** None (fully decoupled)

### Plugin Management

#### plugins

Management UI for the Plugin Host. Provides the Plugins pane (left sidebar), plugin cards with wrench context menus (enable/disable, settings, uninstall), and a README detail view as an editor document type (`about:plugin-readme/<name>`). Maintains a `PluginService` that tracks plugin state, handles orphaned README tab cleanup, and logo cache invalidation on refresh.

- **Entry:** `studio/src/modules/plugins/index.ts`
- **Commands registered:** `plugins.focusPluginsPane`, `plugins.refreshPluginList`, `plugins.openPluginFolder`
- **Editor document types:** `plugin-readme` (URI pattern: `about:plugin-readme/`)
- **Dependencies (commands):** `std` (via `std.settings.openUserSettingsAtCategory`)
- **Dependencies (imports):** None (communicates via `bifrost.plugins` subsystem)
- **Architecture doc:** [plugin-host.md](plugin-host.md)

### Utilities

#### machine-sanctum

Playground for plugin developers. Provides a visual interface for trying out Studio features (notifications, dialogs, etc.) with JSON-based configurations and live preview.

- **Entry:** `studio/src/modules/machine-sanctum/index.tsx`
- **Dependencies (commands):** `std`

## Dependency Graph

```
std ────────────────────────────────────────────────────┐
  ├─ settings (sub-feature)                             │ (no module deps)
  ├─ help (sub-feature)                                 │
  ├─ aboutpage (sub-feature)                            │
  └─ startpage (sub-feature)                            │
                                                        │
themes ─────────────────────────────────────────────────┤ (no module deps)
                                                        │
bpmn-core ──────────────────────────────────────────────┤ (no module deps)
bpmn-editor ← bpmn-core (import)                        │
            ← std (incl. std.help.open), bpmn-diff (cmd)│
bpmn-linter ← bpmn-core (import),                       |
            - std, bpmn-editor (cmd)                    │
bpmn-token-simulator ← bpmn-core (import)               |
                     - std, bpmn-editor (cmd)           │
bpmn-diff ← bpmn-editor (cmd)                           │
                                                        │
dmn-core ───────────────────────────────────────────────┤ (no module deps)
dmn-editor ← dmn-core (import)                          │
dmn-diff ← dmn-core/diff (import)                       │
                                                        │
git-cruiser ← std (cmd), bpmn-diff, dmn-diff (cmd)      │
                                                        │
machine-sanctum ← std (cmd)                             │
                                                        │
engine-core ← std (Bifrost APIs)                        │
  registers: engineConnectionManager,                   │
             engineWebSocketBridge                      │
engine-workspace ← engine-core (import + cmd)            │
                 ← bpmn-core (moddle descriptor)        │
  registers: engine-workspace.taskInbox.pendingCounts   │
engine-model-viewer ← engine-core, bpmn-core (import)    │
engine-decision-viewer ← engine-core, dmn-core (import)  │
engine-debugger ← engine-core, bpmn-core, dmn-core      │
                ← engine-decision-viewer/types (import) │
                ← engine-workspace (cmd)                │
                                                        │
plugins ← std (cmd: std.settings.openUserSettingsAtCategory)│
```

## Known Architectural Notes

## File Path Reference

| Component | Path |
|-----------|------|
| Module load site | `studio/src/createAndInitializeBifrost.ts` |
| ModuleManager | `studio/src/bifrost/common/ModuleManager.ts` |
| ModuleMediator | `studio/src/bifrost/browser/ModuleMediator.ts` |
