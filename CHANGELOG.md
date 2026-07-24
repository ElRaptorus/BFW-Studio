# Bifrost Forge World — Feature Overview

A curated overview of the Studio's standout capabilities for the v1 release.

---

## BPMN Modeling

### Token Simulator

A built-in token flow simulator that lets you execute BPMN diagrams step-by-step directly inside the editor. Walk through exclusive gateways, observe parallel forks and joins, and validate that your process logic behaves as intended — all without deploying to an engine.

This is a custom implementation purpose-built for the Studio's architecture. See [architecture](./docs/architecture/bpmn-token-simulator.md) for technical details.

### FEEL Expression Simulator

A sandbox environment for authoring and testing FEEL expressions with instant feedback.

- Available inside all multi-line script editors (open in a separate tab for a full editing experience)
- Also available as a standalone sandbox tool in the Machine Sanctum
- The Studio is designed exclusively around FEEL — no JavaScript scripting

**Planned:** Single-line editor support, visual variable builder (instead of raw JSON input).

### Subprocess Drilldown / Drillup

Navigate into embedded subprocesses with a single click, and back up via breadcrumb navigation. Each subprocess plane renders in isolation with its own element scope and property context. See [architecture](./docs/architecture/bpmn-drilldown.md).

### Diff View

Open a visual diff directly from the BPMN editor to see what changed since the last commit.

- **Show Summary** generates a curated changelog of all registered diagram changes
- The Property Pane displays an equivalent change summary that users can click through

See [architecture](./docs/architecture/bpmn-diff.md).

### Merge Editor / Conflict Resolver

A dedicated editor for resolving BPMN merge conflicts — same visualization as the Diff View, plus interactive conflict resolution (per-conflict or in bulk).

### Version Restore

Restore previous diagram versions from the Git commit history. Available for both BPMN and DMN files via the editor toolbar's History button.

### Version Management

- New pools are automatically assigned the version `1.0.0`
- One-click **Bump Version** command for semver-style increments across all processes in a file
- Guided Version Conflict Resolution when deploying to the Engine

---

## DMN Modeling

### Full-Featured DMN Editor

A complete DMN editor with the same interaction semantics as the BPMN editor:

- Property Panes with inline FEEL expression editing
- Full DMN element support (Decision Tables, Literal Expressions, Boxed Expressions)
- Integrated sanitizer and validation
- Business Rule Task wiring with drill-down into referenced decisions
- Git integration (diff, version restore)
- Built for the Daemon Engine's CL3-compliant DMN evaluation engine

See [architecture](./docs/architecture/dmn-editor.md).

### DMN Merge Editor / Conflict Resolver

A dedicated three-panel merge editor for resolving DMN conflicts — the same approach as the BPMN merge editor, applied to decision models. Supports per-conflict and bulk resolution.

### Decision Viewer with Ad-Hoc Evaluation

Inspect deployed DMN definitions on a connected engine and test them interactively:

- Read-only DRD viewer with version switching
- Import-chain navigation for multi-model decision graphs
- Ad-hoc evaluation panel — provide input values and execute the decision against the engine without needing a running process instance

**Planned:** Decision Simulator (analogous to the BPMN Token Simulator), cross-diagram import resolution for multi-model decision graphs.

---

## Quality Tools

### BPMN Linter

A fully configurable static analysis engine for BPMN diagrams.

- Configurable rule sets with three severity levels: Info, Warning, Error
- Full-color visualization of findings directly on the canvas
- Right-area panes: **Score** (aggregate quality score) and **Problems** (detailed issue list)
- Scores are persisted in the BPMN XML so that downstream tools (e.g. the Daemon Engine's linter gate) can evaluate them at deploy time
- Can be disabled per-project via settings

See [architecture](./docs/architecture/bpmn-linter.md).

### BPMN Sanitizer

An always-on structural integrity scanner that detects invisible elements, dangling references, empty property collections, and other silent corruption after every diagram change.

- Issues listed in the Inspector Pane
- Per-issue quick-fix and "Fix All" bulk repair

See [architecture](./docs/architecture/bpmn-sanitizer.md).

---

## User Task Form Builder

A standalone GUI editor for designing User Task forms — replacing the traditional click-heavy inline property panels.

- Accessible from the User Task Property Pane (click opens the editor, Shift+click opens it side-by-side)
- Live form preview
- Streamlined form type palette (user-friendly subset focused on practical modeling)
- Form Action collection modeled after the dialog system (Yes, No, Confirm, Cancel, Custom)

---

## Engine Integration

### Deploy & Run

A complete design-to-execution loop without leaving the Studio.

- **Deploy** the active BPMN or DMN diagram to a connected engine with a single keystroke (F3)
- **Deploy & Debug** deploys and immediately opens the Instance Debugger (Shift+F3)
- **Solution Deploy** sends all diagrams in the active solution to the engine in one batch
- **Configured Start** parses the process's start events, prompts for event selection and key/value payload entries, then starts the instance — making message, timer, and conditional starts testable without writing REST calls

### Engine Browser

A six-view management panel for connected Daemon Engine instances:

| View | Purpose |
|------|---------|
| **Dashboard** | Engine health at a glance |
| **Processes** | Deployed BPMN process definitions |
| **Decisions** | Deployed DMN decision definitions |
| **Instances** | Running and completed process instances |
| **Task Inbox** | Waiting User Tasks with direct links to the Debugger |
| **Timer Schedule** | All active cyclic timer schedules |

Additional read-only viewers for inspecting deployed BPMNs and DMNs, plus a dedicated Instance Debugger.

See [architecture](./docs/architecture/engine.md).

### Live Instance Debugger

A WebSocket-driven overlay that visualizes process execution in real time.

- Live flow-node-instance state badges and token markers on top of the BPMN diagram
- Updates instantly as the engine advances the process
- **Runtime FEEL Runner** — evaluate expressions against the live process instance context (token, data objects, identity, selected flow node) rather than mock data
- **DMN Trace step-into** — when a Business Rule Task completes, inspect the full evaluation trace: matched rules, hit policies, BKM invocation chains, and import sub-traces
- **Retry-at-flow-node** — overlay links to retry from a specific flow node on failed instances
- **Debugger export** — PNG, SVG, CSV, or JSON snapshots of annotated debugger diagrams for operational reports

---

## Workspace & Navigation

### Multi-Root Solutions

Support for multi-root folder solutions (analogous to VSCode workspaces), allowing multiple project directories to coexist in a single Studio window.

See [architecture](./docs/architecture/workspace.md).

### Git Integration

Built-in Git support for the editor, File Explorer, and Open Editors panel.

- Toggleable Git pane in the left sidebar
- File tree decorations reflecting current repository status
- Foundation for the BPMN and DMN Diff Views
- **Protected Diagrams** — define glob patterns for critical BPMN files; the Studio warns before committing changes to protected paths, acting as a governance guardrail for shared process libraries
- **Note:** Repository detection currently does not recurse into subdirectories. The project root must be either the repository root or a direct subfolder of one.

See [architecture](./docs/architecture/git-cruiser.md).

### Quick Jump / Command Palette

A modal fuzzy finder for navigating the Studio:

- **Command Palette** (Cmd/Ctrl+Shift+P) — search and execute any registered command
- **Recent Files** (Cmd/Ctrl+J) — jump to recently opened files and solutions
- **Go to Symbol in Solution** (Cmd/Ctrl+Shift+J) — find BPMN/DMN elements by name across all files, backed by a Web Worker symbol index
- **Go to Symbol in Document** (Cmd/Ctrl+Shift+O) — jump to elements within the active diagram

### Global Search

Project-wide text search with:

- Include/Exclude glob patterns
- Toggle to search only within open files
- Instant results on keystroke (no Enter required)

### File Explorer

- Drag and drop to move files and folders (Ctrl+click to copy)
- Multi-selection with bulk drag-and-drop
- External files and folders can be dropped onto the explorer to add them to the solution (as root items or copies)
- Folders/solutions can be opened in a new window or replace the current one
- Individual folders can be hidden via context menu (by name glob or project-relative path), persisted in settings

---

## Editor Infrastructure

### Theming System

A comprehensive semantic token-based theming system. Themes are fully inheritable and can be contributed by modules and plugins. Ships with 10+ built-in themes including Forge World Day/Night, VS Code Light/Dark, Zed Light/Dark, Tomb World, Fenris, Medusa, and The Dark City.

See [architecture](./docs/architecture/theming.md).

### Settings

A dual-mode settings system with both a GUI editor and a raw JSON editor.

- All settings are registered with typed descriptors at the Settings Manager
- Modules and plugins declare their own settings sections

See [architecture](./docs/architecture/settings.md).

### 4-Area Pane Layout

| Area | Role |
|------|------|
| **Left** | Explorer panes, toggled via the menu bar above |
| **Center** | Editor area |
| **Bottom** | Inspector — analysis and debugging tools for the active editor tab |
| **Right** | Toolbox — grouped panes: Property, Scripting, Dataflow, Documentation (plus Linter and plugin-contributed groups) |

See [architecture](./docs/architecture/workbench-layout.md).

### Status Bar

A dynamic status bar at the bottom of the application:

- Priority-based item ordering
- Progress indicator system (views can fill a shared progress bar)
- Diagnostics badges: extensions can surface errors and warnings per view
- Standard items: encoding, line ending, solution badge, Git status

See [architecture](./docs/architecture/status-bar.md).

### Integrated Fallback Editors

Built-in Markdown and Monaco-based text editors for non-BPMN/DMN files — a convenient fallback when browsing project files with "Show hidden files" enabled.

---

## Plugin System

A process-isolated, permission-gated plugin architecture.

- Each plugin runs in its own SES-sandboxed Worker Thread, orchestrated by the Plugin Host
- Plugins are individually toggleable with a dedicated management pane
- Permissions must be declared upfront (filesystem, commands, renderer modules, native access, etc.)
- Network access via Node.js native libraries is blocked by default
- Declarative feature manifest for commands, panes, webview-based documents, menus, settings, themes, and more
- Full API bridge for runtime interaction with the Studio

**Current status:** Phase 9 of 11 finished — see the [full roadmap](./docs/extensions-v2/extension-v2-roadmap.md), [example plugins](./studio/test/fixtures/plugins), and the [plugin template generator](./tools/create-evil-plugin/).

See [architecture](./docs/architecture/plugin-host.md) and [manifest reference](./docs/architecture/plugin-manifest.md).

---

## Roadmap

Ideas under consideration for future development:

- Replace Monaco Editor with CodeMirror (lighter weight, native FEEL support, better performance)
- Process Landscape Map as a solution-level feature
- Project organization tools (grouping, tagging, folder organization by tags) — potentially combined with the landscape map
- Cross-process data and message flow visualization ("Flow Chart") with optional debugger integration
- DMN Decision Simulator
- DMN cross-diagram import resolution
- Collaborative modeling tools
- Multi-platform format support (read and convert diagrams from other BPM platforms)
