---
name: understand-codebase
description: >-
  Onboards agents to the Bifrost Forge World codebase structure, architecture,
  and key patterns. Use when exploring the project for the first time, when
  asked to understand how something works, or before making architectural changes.
---

# Understanding the Bifrost Forge World Codebase

## Step 0: Project Overview

Bifrost Forge World is a ReactJS / Electron application for modelling, deploying, and debugging BPMN 2.0 process models. Its core functionality is delivered through internal modules — the same mechanism available to third-party developers. The framework powering it is called **Bifrost**.

| Directory | What's here |
|-----------|------------|
| `studio-sdk/` | Public SDK: types, contracts, and reusable React components for plugins |
| `studio/src/bifrost/` | Core framework: Electron entrypoints, mediators, contracts, services |
| `studio/src/modules/` | Built-in modules (std, bpmn-editor, engine-*, git-cruiser, etc.) |
| `studio/src/components/` | Shared internal React components |
| `docs/` | Project documentation (architecture, systeme, philosophie, testing) |

## Step 1: Read the Architecture Index

Start with `docs/architecture/index.md`. It lists ~20 topic files, each a standalone technical reference covering one subsystem. These are the primary knowledge base for agents.

## Step 2: Drill Into Relevant Topics

Based on your task, read the specific architecture doc:

| Task | Read |
|------|------|
| Commands and user interactions | `docs/architecture/commands.md` |
| Module system and load order | `docs/architecture/modules.md` |
| Editor document types | `docs/architecture/editor-documents.md` |
| Dialogs and user input | `docs/architecture/dialogs.md` |
| Notifications | `docs/architecture/notifications.md` |
| Tree components (file explorer, etc.) | `docs/architecture/tree.md` |
| Settings system | `docs/architecture/settings.md` |
| BPMN modeler customization | `docs/architecture/bpmn-modeler-modules.md` |
| BPMN token simulator | `docs/architecture/bpmn-token-simulator.md` |
| Engine connectivity | `docs/architecture/engine.md` |
| Build system / Rspack | `docs/architecture/build.md` |
| Theming / CSS tokens | `docs/architecture/theming.md` |
| Icons | `docs/architecture/icons.md` |
| Git integration | `docs/architecture/git-cruiser.md` |
| Workbench layout | `docs/architecture/workbench-layout.md` |
| Import aliases and tsconfig | `docs/architecture/imports-and-modules.md` |
| Code quality / ESLint / Prettier | `docs/architecture/code-quality.md` |
| Known gotchas | `docs/architecture/common-pitfalls.md` |

## Step 3: Key Modules by Layer

### Bifrost Core (`studio/src/bifrost/`)

The framework that makes the Studio work. Key areas:

- **Electron entrypoints**: `electron-main/`, `electron-renderer/` — process lifecycle, IPC, preload
- **Mediators**: The public API surface modules interact with. Each mediator wraps an internal manager:
  - `CommandMediator` → commands, `PaneMediator` → panes, `SettingsMediator` → settings
  - `DialogMediator` → dialogs, `NotificationMediator` → notifications, `ThemeMediator` → themes
  - `EditorDocumentMediator` → document types, `IconMediator` → icons
- **SharedWorker / WebWorker**: `sharedworker/`, `webworker/` — cross-tab state and heavy computation

### Modules (`studio/src/modules/`)

Key modules and their roles:

| Module | Role |
|-----------|------|
| `std` | Standard commands, menus, panes, keybindings, file explorer. Bundles sub-features: settings, help, aboutpage, startpage |
| `bpmn-core` | Foundation: BPMN document type, shared BPMN utilities |
| `bpmn-editor` | BPMN modeler integration (bpmn-js), properties panel |
| `bpmn-diff` | BPMN diagram diff viewer |
| `bpmn-token-simulator` | Token flow simulation on BPMN diagrams |
| `engine-core` | Foundation: EngineManager, engine events, shared engine utilities |
| `engine-browser` | Process instance browser, deployment UI, engine menubar |
| `engine-debugger` | Runtime debugging of process instances |
| `engine-bpmn-viewer` | Remote BPMN viewer for engine-deployed processes |
| `git-cruiser` | Git integration (status, commit, diff, BPMN diff) |

Foundation modules (`bpmn-core`, `engine-core`) provide shared infrastructure. Consumer modules build on top. Foundation → consumer communication uses mediator events, never direct calls.

### SDK (`studio-sdk/`)

Public types and contracts: `contracts/` (interfaces for Bifrost API), `components/` (reusable React components), `common/` (shared utilities), `browser/` (browser-specific helpers).

## Step 4: Core Patterns

The 4 patterns agents encounter most:

### 1. Command Registration and Execution

All interactions flow through commands. Modules register commands via `bifrost.commands.register(name, callback, options?)` and execute them via `bifrost.commands.executeCommand()`. See the `bifrost-commands` skill.

### 2. Module Lifecycle

Modules implement `onLoad` (register commands, menus, panes) → `onActivate` (set up event listeners) → `ready` event (safe to open dialogs). See `docs/architecture/modules.md`.

### 3. Editor Document Types

Modules register document types that bind a URI pattern to a model class, renderer component, and inspector component. See the `docs/architecture/editor-documents.md`.

### 4. Module Discovery for BPMN Modeler

Extensions register diagram-js modules via `bpmn.modeler.registerModule` to add custom behaviors, overlays, or context pads to the BPMN editor. See the `bpmn-modeler-extensions` skill.
