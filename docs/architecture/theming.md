# Theming System

The Studio uses a CSS custom property-based theming system that enables easy theme switching. Colors across the UI are driven by semantic tokens (`--theme-*`) defined in dedicated theme files and consumed via `var()` references.

## Architecture

### Core Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `ThemeManager` | `studio/src/bifrost/common/ThemeManager.ts` | Stores theme registry and active theme state. No DOM dependency — purely data/logic. |
| `ThemeMediator` | `studio/src/bifrost/browser/ThemeMediator.ts` | Public API on `bifrost.theme` — applies themes to DOM, persists to settings. In `browser/` because it manipulates `rootElement` directly. |
| `theme.light.scss` | `studio/src/bifrost/styles/theme.light.scss` | Light theme token definitions |
| `theme.dark.scss` | `studio/src/bifrost/styles/theme.dark.scss` | Dark theme token definitions |
| `bifrost.scss` | `studio/src/bifrost/styles/bifrost.scss` | Structural layout + token-based color references |
| `ThemeTypes.ts` | `studio/src/bifrost/contracts/ThemeTypes.ts` | TypeScript types (`ThemeType`, `ThemeDefinition`) |
| `ThemeEvents.ts` | `studio-sdk/src/contracts/internal/ThemeEvents.ts` | Event constant (`EVENT_THEME_CHANGED`) |

### Placement Convention

The split between `common/` and `browser/` follows the project-wide convention:

- **`common/`** — Classes with no DOM dependency (data, logic, state). `ThemeManager` stores the registry and tracks the active theme.
- **`browser/`** — Classes that manipulate the DOM. `ThemeMediator` calls `rootElement.style.setProperty()` and `rootElement.classList.add()`.

This mirrors other Bifrost subsystems (e.g., `SettingsManager` in `common/`, `MenuMediator` in `browser/`).

### How It Works

1. Two built-in themes (`light` / "Bifrost Day" and `dark` / "Bifrost Night") are registered by the `std` module during load. Two additional themes (`white-fall` / "White Fall" and `dark-grey` / "Dark Grey") are registered by the `themes` module, which loads immediately after `std`.
2. Each theme defines all `--theme-*` CSS custom properties under its explicit class selector (e.g., `.bifrost.bifrost-theme--light`, `.bifrost.bifrost-theme--dark`, `.bifrost.bifrost-theme--white-fall`, `.bifrost.bifrost-theme--dark-grey`).
3. `bifrost.scss` and component SCSS files reference these tokens using `var(--theme-*)`.
4. The active theme class is applied to the root `<div class="bifrost bifrost-theme--{id}">` element in `App.tsx`.
5. When a theme is switched, the `ThemeMediator` updates the CSS class on the root element and persists the choice to the `workbench.general.theme` setting.
6. The `workbench.general.theme` setting uses factory functions for its `enum` and `enumLabels` fields, so the Settings GUI dropdown dynamically reflects all registered themes (including any added by plugins).

### Theme Application Flow

```
User selects theme
  → bifrost.theme.setTheme('dark')
    → ThemeManager.setActiveThemeId('dark')
      → emits EVENT_THEME_CHANGED
    → settings.set('workbench.general.theme', 'dark')
    → ThemeMediator.applyTheme('dark')
      → swaps CSS class: bifrost-theme--light → bifrost-theme--dark
  → App.tsx re-renders with new class name
```

## Semantic Token System

### Token Categories

All tokens use the `--theme-` prefix. They are organized by UI surface:

- **Base**: `--theme-bg`, `--theme-fg`, `--theme-fg-secondary`, `--theme-fg-muted`, `--theme-border`, `--theme-focus`, `--theme-accent`, `--theme-link`, `--theme-shadow`
- **Icon Colors**: `--theme-icon-red`, `--theme-icon-orange`, `--theme-icon-green`, etc.
- **Surfaces**: `--theme-surface-primary`, `--theme-surface-secondary`, `--theme-surface-elevated`, `--theme-surface-canvas`, `--theme-surface-inset`, `--theme-surface-backdrop`
- **Menu Bar**: `--theme-menu-bar-bg`, `--theme-menu-bar-fg`, `--theme-menu-bar-hover-bg`
- **Status Bar**: `--theme-status-bar-bg`, `--theme-status-bar-fg`, `--theme-status-bar-border`, `--theme-status-bar-hover-bg`
- **Editor Tabs**: `--theme-editor-tab-bg`, `--theme-editor-tab-active-bg`, `--theme-editor-tab-active-fg`, `--theme-editor-tab-controls-fg`, `--theme-editor-tab-controls-hover-bg`
- **Editor Toolbar**: `--theme-editor-toolbar-bg`, `--theme-editor-toolbar-fg`, `--theme-editor-toolbar-icon`, etc.
- **Editor Content**: `--theme-editor-bg`, `--theme-editor-canvas-bg`, `--theme-canvas-editing-bg`, `--theme-editor-loading-error-bg`, `--theme-editor-loading-warning-bg`, `--theme-editor-loading-border`
- **Pane**: `--theme-pane-bg`, `--theme-pane-tab-bg`, `--theme-pane-tab-active-bg`, `--theme-pane-divider`, `--theme-pane-toolbar-fg`, `--theme-pane-toolbar-hover-fg`, etc.
- **Tree View**: `--theme-tree-bg`, `--theme-tree-fg`, `--theme-tree-hover-bg`, `--theme-tree-selected-bg`, etc.
- **Buttons**: `--theme-btn-primary-bg`, `--theme-btn-secondary-bg`, `--theme-btn-danger-bg`, etc.
- **Form Controls**: `--theme-input-bg`, `--theme-input-fg`, `--theme-input-border`, `--theme-input-focus-shadow`, etc.
- **Tables**: `--theme-table-bg`, `--theme-table-border`, `--theme-table-hover-bg`, `--theme-control-table-*`, etc.
- **Quick Jump**: `--theme-quick-jump-bg`, `--theme-quick-jump-input-bg`, `--theme-quick-jump-hover-fg`, `--theme-quick-jump-focused-fg`, `--theme-quick-jump-border`, `--theme-quick-jump-focus-shadow`, etc.
- **Modal/Dialog**: `--theme-modal-bg`, `--theme-modal-fg`, `--theme-modal-border`
- **Context Menu**: `--theme-context-menu-bg`, `--theme-context-menu-hover-bg`, `--theme-context-menu-fg`, `--theme-context-menu-separator`, etc.
- **Dropdown**: `--theme-dropdown-bg`, `--theme-dropdown-hover-bg`, etc.
- **Notifications**: `--theme-notification-bg`, `--theme-notification-container-bg`, etc.
- **Inline Search**: `--theme-inline-search-bg`, `--theme-inline-search-input-bg`, etc.
- **Cards**: `--theme-card-bg`, `--theme-card-border`, `--theme-card-footer-bg`
- **Validation**: `--theme-validation-error-bg`, `--theme-validation-success-fg`, etc.
- **Error Boundary**: `--theme-error-boundary-bg`, `--theme-error-boundary-fg`
- **Todo/Dev Indicator**: `--theme-todo-gradient-start`, `--theme-todo-gradient-end`, `--theme-todo-overlay-bg`

### Token Symmetry

**Core tokens**: Every token defined in `theme.light.scss` **must** also be defined in `theme.dark.scss` and vice versa. This ensures any component using `var(--theme-*)` always resolves to a value regardless of which theme is active.

**Module tokens**: The same symmetry rule applies within each module's SCSS file — every token defined in the `.bifrost.bifrost-theme--light` block must also appear in `.bifrost.bifrost-theme--dark` and vice versa.

## Token Ownership: Hybrid Model

### Core Tokens

Tokens that describe the Studio's shared UI surfaces are defined centrally in `theme.light.scss` and `theme.dark.scss`. Modules reference these tokens without defining them.

Example — a component using core tokens:

```scss
.my-component__header {
  background: var(--theme-surface-primary);
  color: var(--theme-fg);
  border-bottom: 1px solid var(--theme-border);
}
```

### Module-Specific Tokens

**Critical rule**: Module-specific theme tokens must NEVER be defined in the core theme files (`theme.light.scss`, `theme.dark.scss`) or in `bifrost.scss`. They must be defined in the module's own SCSS file. The bifrost core must have no knowledge of module-specific tokens. This mirrors the architectural restriction applied to components.

Module-specific tokens include both `--color-*` (icon tints, brand colors) and `--theme-*` tokens (UI surface colors used exclusively by one module). Both kinds are defined in the module's SCSS, providing light and dark values using the explicit class pattern:

```scss
// In the module's own SCSS file (e.g., bpmn-editor/styles/bpmn.scss)
.bifrost.bifrost-theme--light {
  --color-my-module-icon-primary: #183b5f;
  --theme-my-module-surface-bg: #f0f0f0;
}

.bifrost.bifrost-theme--dark {
  --color-my-module-icon-primary: #31a3dd;
  --theme-my-module-surface-bg: #323232;
}
```

Themed CSS overrides for third-party library elements (e.g., bpmn-js `.djs-palette`, `.bjs-container`) also belong in the module that imports and uses that library, not in `bifrost.scss`.

**Current module token ownership**:

| Module | Token prefixes | SCSS file |
|-----------|---------------|-----------|
| `bpmn-editor` | `--theme-diagram-*`, `--theme-color-picker-*`, `--color-bpmn-*` | `modules/bpmn-editor/styles/bpmn.scss` |
| `bpmn-core` (diff) | `--theme-diff-*` | `modules/bpmn-core/diff/styles/component.bpmn-diff-infrastructure.scss` |
| `bpmn-core` (overlays) | `--color-element-*`, `--color-process-*`, `--backcolor-element-*` | `modules/bpmn-core/overlays/BpmnElementOverlays.scss` |
| `bpmn-diff` | `--color-bpmn-diff-*`, `--backcolor-bpmn-diff__*` | `modules/bpmn-diff/styles/component.bpmn-diff.scss` |
| `bpmn-token-simulator` | `--token-sim-*` | `modules/bpmn-token-simulator/token-simulation.scss` |
| `engine-debugger` | `--color-engine__debugger-*`, `--color-flow-node-*`, `--backcolor-flow-node-*` | `modules/engine-debugger/EngineDebugger.scss` |
| `engine-browser` | `--color-engine__browser-*`, `--color-engine__menubar--*` | `modules/engine-browser/EngineBrowser.scss` |
| `engine-bpmn-viewer` | `--color-engine__bpmn-viewer-*` | `modules/engine-bpmn-viewer/RemoteBpmnViewer.scss` |
| `bpmn-linter` | `--lint-*` | `modules/bpmn-linter/styles/bpmn-linter.scss` |
| `git-cruiser` | `--theme-git-*` | `modules/git-cruiser/styles/git-cruiser.scss` |
| `machine-sanctum` | `--color-theme-demo-*`, `--color-machine-sanctum-*` | `modules/machine-sanctum/styles/machine-sanctum.scss` |
| `std` (startpage) | `--color-startpage-*`, `--theme-startpage-*` | `modules/std/startpage/styles/startpage.scss` |
| `std` (aboutpage) | `--color-about-*` | `modules/std/aboutpage/styles/aboutpage.scss` |
| `std` (settings) | `--color-settings-editor-*` | `modules/std/settings/styles/settings.scss` |
| `std` (default-editors) | `--color-markdown-editor-*`, `--color-default-editor-*` | `modules/std/default-editors/styles/editor-documents.styles.scss` |
| `std` (help) | `--color-help-*` | `modules/std/help/styles/component.help.scss` |
| FEEL editor (SDK) | `--theme-feel-*` | `components/feel-editor/component.feel-editor.scss` |

**Merge tokens** (`--theme-merge-ours-*`, `--theme-merge-theirs-*`, `--theme-merge-result-*`, `--theme-merge-conflict-*`, `--theme-merge-auto-foreground`) are consumed by `bpmn-editor/merge` and `git-cruiser/merge` with CSS fallbacks. They are defined in the extra `themes` module SCSS files but not in the core themes (core themes rely on the fallback values).

Both core and module-specific tokens always use the explicit `.bifrost.bifrost-theme--<id>` selector. There is no implicit `.bifrost` fallback for colors.

## Theme API (`bifrost.theme`)

The `ThemeMediator` extends `AbstractEmitter`, so modules can subscribe to theme events.

### Available Methods

| Method | Return | Description |
|--------|--------|-------------|
| `registerTheme(definition)` | `void` | Register a custom theme |
| `setTheme(id)` | `void` | Switch to a registered theme |
| `getCurrentTheme()` | `string` | Get the active theme ID |
| `getCurrentThemeType()` | `'light' \| 'dark'` | Get the active theme's type |
| `isCurrentThemeDark()` | `boolean` | Shorthand for `getCurrentThemeType() === 'dark'` |
| `getRegisteredThemes()` | `ThemeDefinition[]` | List all registered themes |
| `on(event, listener)` | `AbstractSubscription` | Subscribe to theme events (inherited from `AbstractEmitter`) |

### ThemeDefinition Type

```typescript
type ThemeDefinition = {
  id: string;
  label: string;
  type: 'light' | 'dark';
};
```

### Registering a Custom Theme

Modules register custom themes by calling `registerTheme()` with metadata, then providing the actual token definitions in an SCSS file under `.bifrost.bifrost-theme--<id>` selectors:

```typescript
bifrost.theme.registerTheme({
  id: 'dark-high-contrast',
  label: 'Dark High Contrast',
  type: 'dark',
});
```

```scss
.bifrost.bifrost-theme--dark-high-contrast {
  --theme-bg: #000;
  --theme-fg: #fff;
  --theme-border: #fff;
  // ... all other tokens the theme needs
}
```

The `registerTheme()` call only registers the theme's metadata (so the Studio can list and switch to it). All token definitions live in SCSS, following the same pattern as the built-in themes and module-specific tokens.

### Querying Theme in TypeScript

```typescript
const monacoTheme = studio.theme.isCurrentThemeDark() ? 'vs-dark' : 'vs-light';
```

### Reacting to Theme Changes

```typescript
import { EVENT_THEME_CHANGED } from '@evil/bifrost_fw_sdk/contracts/internal/ThemeEvents';

bifrost.theme.on(EVENT_THEME_CHANGED, (themeId: string) => {
  // update monaco theme, re-render, etc.
});
```

Do **not** use `bifrost.settings.on(EVENT_SETTINGS_CHANGED, ...)` to detect theme changes. Always use `bifrost.theme.on(EVENT_THEME_CHANGED, ...)`.

Do **not** check `bifrost.settings.get('workbench.general.theme') === 'dark'`. Always use `studio.theme.isCurrentThemeDark()` or `studio.theme.getCurrentThemeType()`.

## Theme Switching Entry Points

Users can switch themes through:

1. **Command Search**: "Workbench: Choose theme ..." (`std.workbench.chooseTheme`)
2. **Status Bar**: Palette icon on the right side of the status bar
3. **Welcome Page**: Theme link on the start page

## Registered Themes

| ID | Label | Type | Source |
|----|-------|------|--------|
| `light` | Bifrost Day | `light` | `std` module — cold/snowy palette with icy blue accents and high-contrast black text |
| `dark` | Bifrost Night | `dark` | `std` module — very dark blue-black palette with blue-tinted text and deep blue accents |
| `snow-fall` | Snow Fall | `light` | `themes` module — preserves the original "Light" palette |
| `grey-stone` | Grey Stone | `dark` | `themes` module — preserves the original "Dark" palette |
| `vscode-light` | VS Code Light | `light` | `themes` module — VS Code "Default Light Modern" palette with corporate blue (#005FB8) accent |
| `vscode-dark` | VS Code Dark | `dark` | `themes` module — VS Code "Default Dark Modern" palette with pure dark grays and blue (#0078D4) accent |
| `forge-world-day` | Forge World Day | `light` | `themes` module — warm cream tones with amber-gold (#C08530) accent, forge-glow aesthetic |
| `forge-world-night` | Forge World Night | `dark` | `themes` module — warm neutral darks with amber-gold (#C08530) accent, smoldering forge aesthetic |
| `zed-light` | Zed Light | `light` | `themes` module — Zed's "One Light" palette with clean near-white and indigo-blue (#5C78E2) accent |
| `zed-dark` | Zed Dark | `dark` | `themes` module — Zed's "One Dark" palette with warm-tinted dark grays and soft blue (#74ADE8) accent |

All `themes` module SCSS files are fully self-contained: they include all core `--theme-*` tokens plus all module-specific token overrides merged into a single file each. This covers every token group: diff view, token simulator, engine debugger, engine browser, engine BPMN viewer, BPMN element overlays, merge editor, machine sanctum, inspector, std module icons, linter, git cruiser, FEEL editor, and MDX editor. This is appropriate because the `themes` module is itself a module, not core functionality.

When a new module defines theme tokens, those tokens must also be added to every extra theme SCSS file in the `themes` module. Otherwise, those tokens will be undefined when the user selects an extra theme.

## Default Theme

The default theme is **dark** / "Bifrost Night" (`workbench.general.theme: 'dark'`, registered in `Bifrost.ts`). This aligns with modern editor conventions.

## Alias Variables: Scope Rule

`bifrost.scss` defines convenience aliases that map `--color-*` names to `--theme-*` tokens (e.g., `--color-table-normal-background: var(--theme-table-bg)`). These aliases **must** be defined inside the `.bifrost { }` block, never on `:root`.

**Reason**: `--theme-*` tokens are defined on `.bifrost.bifrost-theme--light` / `.bifrost.bifrost-theme--dark`. If an alias referencing `var(--theme-*)` is placed on `:root`, the theme token may not resolve correctly because `:root` is outside the scope where theme tokens are defined. Placing aliases in `.bifrost` ensures they share scope with the theme definitions and resolve reliably.

```scss
// CORRECT — aliases inside .bifrost
.bifrost {
  --color-table-normal-background: var(--theme-table-bg);
  --color-splitter: var(--theme-splitter);
}

// WRONG — aliases on :root where --theme-* tokens don't exist
:root {
  --color-table-normal-background: var(--theme-table-bg); // may not resolve
}
```

Fixed color values (like `--color-black: #000`) that do not reference theme tokens can safely remain on `:root`.

## Rules for Developers

1. **Never use hardcoded colors in SCSS.** Reference `var(--theme-*)` tokens for shared UI or define module-specific tokens under explicit theme classes.
2. **Never use `.bifrost { }` for color definitions.** Always use `.bifrost.bifrost-theme--light { }` and `.bifrost.bifrost-theme--dark { }` for color token definitions. The bare `.bifrost { }` selector is reserved for structural layout, alias variables, and rules that consume `var(--theme-*)` tokens.
3. **Never place theme-dependent aliases on `:root`.** Aliases that reference `var(--theme-*)` must be inside `.bifrost { }`. Only fixed color values belong on `:root`.
4. **Never check `settings.get('workbench.general.theme') === 'dark'`.** Use `studio.theme.isCurrentThemeDark()` instead.
5. **Never use `EVENT_SETTINGS_CHANGED` for theme detection.** Use `bifrost.theme.on(EVENT_THEME_CHANGED, ...)` instead.
6. **Keep token symmetry.** Every token defined in the light theme must also be defined in the dark theme.
7. **Structural styles are theme-agnostic.** Layout properties (display, flex, overflow, padding, margin) go in the `.bifrost { }` block or component-specific selectors without theme class prefixes.
