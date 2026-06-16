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
 1. std                  (includes settings, help, aboutpage, startpage)
 2. themes               (registers white-fall and dark-grey themes)
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
13. engine-core          (currently commented out)
14. engine-browser       (currently commented out; includes engine menubar)
15. engine-debugger      (currently commented out)
16. engine-bpmn-viewer   (currently commented out)
17. plugins
```

This order respects the dependency graph: `std` first (it bundles all foundational UI — settings, help, about page, start page), `themes` second (registers extra themes after `std` has registered the defaults), then BPMN infrastructure (`bpmn-core` before `bpmn-editor`), then DMN infrastructure (`dmn-core` before `dmn-editor`), then `git-cruiser` (so it can detect registered diff commands), then plugin management (`plugins`) last. Engine modules are currently commented out in `createAndInitializeBifrost.ts` and not loaded at startup.

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
| default-editors | (inline in `initializeEditorDocuments`) | `studio/src/modules/std/default-editors/` | Markdown editor and default text editor |

- **Entry:** `studio/src/modules/std/index.ts`
- **Dependencies:** None
- **Depended on by:** Nearly all other modules (via `std.*` commands, `help.open`, `settings.openUserSettingsAtCategory`)

#### themes

Registers additional color themes (`white-fall` and `dark-grey`) that preserve the original light and dark palettes from before the Bifrost Day/Night redesign. Each theme is defined as a fully self-contained SCSS file with all core and module-specific tokens merged in.

- **Entry:** `studio/src/modules/themes/index.ts`
- **Dependencies:** None
- **Depended on by:** None

### BPMN

#### bpmn-core

Shared BPMN infrastructure. Contains the bpmn-js modeler/viewer adapter, overlay factories, export functions, BPMN-specific solution/project types, the context pad provider, and the modeler module discovery registry.

- **Entry:** `studio/src/modules/bpmn-core/index.tsx`
- **Commands registered:** `bpmn.modeler.registerModule` (allows modules to inject diagram-js modules into every BpmnModeler instance)
- **Dependencies:** None
- **Depended on by:** `bpmn-editor`, `engine-bpmn-viewer`, `engine-debugger` (via direct imports); any module that calls `bpmn.modeler.registerModule` (via command)

#### bpmn-editor

The primary BPMN 2.0 process model editor. Provides the interactive modeler, property panels, fragment renderers, and all editing functionality. Property panes are structured into three groups (`property`, `scripting`, `documentation`) on the right pane area. Uses BPMN 2.0 spec-compliant data model — service tasks use the `implementation` attribute, loops use `StandardLoopCharacteristics` / `MultiInstanceLoopCharacteristics`, user task assignees use `HumanPerformer` / `PotentialOwner` resource roles. See `bpmn-editor-properties.md` for full pane architecture.

- **Entry:** `studio/src/modules/bpmn-editor/index.tsx`
- **Dependencies (commands):** `std` (incl. `help.open`), `bpmn-diff`
- **Dependencies (imports):** `bpmn-core`
- **Depended on by:** `engine-browser/menubar` (via imports)

#### bpmn-diff

Diff view for comparing two BPMN process models side by side.

- **Entry:** `studio/src/modules/bpmn-diff/index.ts`
- **Dependencies (commands):** `bpmn-editor` (via `bpmn.diagram.resetRelevantIds`)

### DMN Editing

#### dmn-core

Shared DMN infrastructure: `DmnModelerComponentAdapter` wrapping `dmn-js`, DMN diff engine (XML structural comparison), moddle extensions, custom command handlers, shared types.

- **Entry:** `studio/src/modules/dmn-core/index.tsx`
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

All engine modules interact with an external Engine via client. The engine is not part of this application.

#### engine-core

Shared engine infrastructure. Provides connectivity management, URL parsing, formatters, and core engine commands (connect, disconnect, process operations).

- **Entry:** `studio/src/modules/engine-core/index.ts`
- **Dependencies (commands):** `std`
- **Depended on by:** `engine-browser` (incl. its menubar sub-feature), `engine-debugger`, `engine-bpmn-viewer`

#### engine-browser

Left menu bar pane and views for interacting with a connected process engine. Contains the process instance list, process model list, connection management UI, and the engine menubar (a sub-feature loaded via `loadMenubar()` from `studio/src/modules/engine-browser/menubar/index.tsx`).

- **Entry:** `studio/src/modules/engine-browser/index.tsx`
- **Dependencies (commands):** `std`, `startpage`, `engine-core`
- **Dependencies (imports):** `engine-core`, `bpmn-editor` (menubar sub-feature)
- **Depended on by:** `engine-debugger`, `engine-bpmn-viewer` (via commands and imports)

#### engine-debugger

Debugger for running process instances. Provides the debugger editor, property panels, overlays, and flow node inspection.

- **Entry:** `studio/src/modules/engine-debugger/index.tsx`
- **Dependencies (commands):** `std`, `engine-core`, `engine-browser`
- **Dependencies (events):** `engine-core` (subscribes to `EVENT_PROCESS_INSTANCE_RETRIED` on `EngineManager`, in the `EngineBpmnDebuggerEditorDocumentModel`)
- **Dependencies (imports):** `bpmn-core`, `engine-core`, `engine-browser`
- **Depended on by:** (none currently)

#### engine-bpmn-viewer

Read-only BPMN viewer for diagrams deployed on a connected engine. Uses a BPMN viewer (not modeler) to display remote process models.

- **Entry:** `studio/src/modules/engine-bpmn-viewer/index.tsx`
- **Dependencies (commands):** `std`, `engine-core`, `engine-browser`
- **Dependencies (imports):** `bpmn-core`, `engine-core`, `engine-browser`

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
- **Dependencies (commands):** `std` (via `settings.openUserSettingsAtCategory`)
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
            ← std (incl. help.open), bpmn-diff (cmd)   │
bpmn-linter ← bpmn-core (import),                       |
            - std, bpmn-editor (cmd)                    │
bpmn-token-simulator ← bpmn-core (import)               |
                     - std, bpmn-editor (cmd)           │
bpmn-diff ← bpmn-editor (cmd)                           │
                                                        │
git-cruiser ← std (cmd)                                 │
                                                        │
machine-sanctum ← std (cmd)                            │
                                                        │
engine-core ← std (cmd)              (commented out)    │
engine-browser ← engine-core, bpmn-editor (import)      │
               ← std, engine-core (cmd)                 │
  └─ menubar (sub-feature)                              │
engine-debugger ← bpmn-core, engine-core,               │
                  engine-browser (import)               │
                ← std, engine-core, engine-browser (cmd)│
engine-bpmn-viewer ← bpmn-core, engine-core,            │
                     engine-browser (import)            │
                   ← std, engine-core, engine-browser   │
                     (cmd)                              │
                                                        │
plugins ← std (cmd: openUserSettingsAtCategory)         │
```

## Known Architectural Notes

## File Path Reference

| Component | Path |
|-----------|------|
| Module load site | `studio/src/createAndInitializeBifrost.ts` |
| ModuleManager | `studio/src/bifrost/common/ModuleManager.ts` |
| ModuleMediator | `studio/src/bifrost/browser/ModuleMediator.ts` |
