# Bifrost Forge World — Introduction

Bifrost Forge World is a ReactJS / Electron application for modelling, deploying, and debugging BPMN 2.0 process models. It connects to one or more external Engines for deployment and runtime interaction.

The Studio is designed around extensibility. Following the "eat your own dogfood" principle, its core functionality is delivered through internal modules — the same patterns available to third-party plugin developers.

## Folder Structure

| Folder | Purpose |
|--------|---------|
| `studio-sdk/` | Public SDK: types, interfaces, contracts, and reusable React components for extension developers |
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
- **Engine Connectivity** — The Studio communicates with external Engines via the `EngineManager` (`bifrost.engines`). See [architecture/engine.md](architecture/engine.md).

## Documentation Map

| Document | Content |
|----------|---------|
| **[introduction.md](introduction.md)** (this file) | Project overview, folder structure, key concepts |
| **[systeme.md](systeme.md)** | Core subsystems: commands, keybindings, menus, dialogs, modules |
| **[philosophie.md](philosophie.md)** | Design philosophy and guiding principles |
| **[testing.md](testing.md)** | Testing infrastructure, StudioAgent API, selector conventions, fixture management |
| **[architecture/](architecture/index.md)** | Detailed architecture reference (start with `index.md` for a topic overview) |
| **[decisions.md](decisions.md)** | Technical decision log with rationale for significant design choices |

## Build

The Studio can be built as an Electron application on Windows, Linux, and macOS. Build scripts are located in `studio/build/`. No code signing is configured and nothing is published externally.

Other build modes (`webapp`, `embedded`) exist but are not functional and can be ignored.
