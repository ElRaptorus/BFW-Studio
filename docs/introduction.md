# Bifrost Forge World — Introduction

Bifrost Forge World is a ReactJS / Electron application for modelling, deploying, and debugging BPMN 2.0 process models. It connects to one or more external Engines for deployment and runtime interaction.

The Studio is designed around extensibility. It comes with a base set of internal modules and provides a powerful plugin system, which allows users to enhance and customize most aspects of the Studio.

## Folder Structure

| Folder | Purpose |
|--------|---------|
| `studio-sdk/` | Plugin SDK: `StudioPluginApi`, POJO contracts, theme tokens, and webview-safe content controls |
| `studio/` | The Studio application itself. Everything here is strictly internal, even if implemented as an extension |
| `docs/` | Project documentation |

### Inside `studio/src/`

| Folder | Purpose |
|--------|---------|
| `bifrost/` | Core framework: Electron entrypoints, mediators, contracts, and services. Provides everything needed to build a visual editor |
| `components/` | Shared React components used across the Studio |
| `modules/` | Pre-packaged internal modules shipped with the Studio (not published externally) |

## Key Concepts

- **Commands** — The primary mechanism for user interaction and cross-extension communication. All interactions flow through `bifrost.commands.executeCommand()`. See [architecture/commands.md](architecture/commands.md).
- **Modules** — Self-contained units that register document types, menus, icons, panes, and commands via the Bifrost API. Foundation modules (`engine-core`, `bpmn-core`) provide shared infrastructure; consumer modules build on top. See [architecture/modules.md](architecture/modules.md).
- **Editor Documents** — The system by which modules provide editors for different content types. Each document type binds a URI pattern to a model, renderer, and inspector. See [architecture/editor-documents.md](architecture/editor-documents.md).
- **Panes** — Side-panel inspectors and module views registered through `PaneProvider`. Visibility is `shouldBeDisplayed`; renderers must not restate that gate. See [architecture/panes.md](architecture/panes.md).
- **Engine Connectivity** — The Studio communicates with external Engines via `EngineConnectionManager` (a shared resource registered by `engine-core`). See [architecture/engine.md](architecture/engine.md).

## Documentation Map

| Document | Content |
|----------|---------|
| **[introduction.md](introduction.md)** (this file) | Project overview, folder structure, key concepts |
| **[systeme.md](systeme.md)** | Core subsystems: commands, keybindings, menus, dialogs, modules |
| **[philosophie.md](philosophie.md)** | Design philosophy and guiding principles |
| **[testing.md](testing.md)** | Testing infrastructure, StudioAgent API, selector conventions, fixture management |
| **[plugin-development-guide.md](plugin-development-guide.md)** | How to author, build, and load a plugin |
| **[architecture/](architecture/index.md)** | Detailed architecture reference (start with `index.md` for a topic overview) |

## Build

The product build is Electron (Windows, Linux, macOS). Scripts live in `studio/build/`. No code signing; nothing is published externally. `__BIFROST_CLIENT__` can be `'electron'`, `'embed'`, or `'webapp'` for dead-code elimination (currently used only on the about page); there is no separate webapp or embedded product. See [architecture/build.md](architecture/build.md).
