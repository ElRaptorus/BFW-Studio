# Icon System

The Studio uses [Phosphor Icons](https://phosphoricons.com/) (v2.1.x) as its sole icon framework, delivered via CSS webfonts for all five supported weights. No JavaScript imports are needed — every icon is rendered as an `<i>` or `<span>` element with appropriate CSS classes.

## Table of Contents

- [Quick Start](#quick-start)
- [Finding Icons](#finding-icons)
- [Weights](#weights)
- [Vendor Files](#vendor-files)
- [Registering Icons](#registering-icons)
- [Using Icons in Components](#using-icons-in-components)
- [Utility Classes](#utility-classes)
- [Duotone Coloring](#duotone-coloring)
- [Custom CSS Classes](#custom-css-classes)
- [Inline SVG Icons](#inline-svg-icons)
- [Composite Icons (Layered)](#composite-icons-layered)
- [Key Files](#key-files)

---

## Quick Start

Every icon is a CSS class string consisting of a **weight class** and an **icon name class**:

```
<weight> ph-<icon-name>
```

Examples:

| What you want            | Class string                  |
|--------------------------|-------------------------------|
| A regular gear icon      | `ph ph-gear`                  |
| A filled star            | `ph-fill ph-star`             |
| A light caret            | `ph-light ph-caret-right`     |
| A bold checkmark         | `ph-bold ph-check`            |
| A duotone folder         | `ph-duotone ph-folder`        |

---

## Finding Icons

Browse the full catalog at **https://phosphoricons.com/**. You can search by keyword and preview all six weights per icon.

The icon name in the catalog maps directly to the CSS class: a catalog entry named "Magnifying Glass" becomes `ph-magnifying-glass`.

---

## Weights

Phosphor provides five weights, each loaded as a separate webfont:

| Weight   | Class prefix  | Visual style                          | Typical use                        |
|----------|---------------|---------------------------------------|------------------------------------|
| Regular  | `ph`          | 1.5px stroke, clean outline           | Default for most UI elements       |
| Fill     | `ph-fill`     | Solid filled shapes                   | Active/selected states, emphasis   |
| Light    | `ph-light`    | 1px thin stroke                       | Subtle/secondary elements          |
| Bold     | `ph-bold`     | 2.5px thick stroke                    | Strong emphasis, checkmarks        |
| Duotone  | `ph-duotone`  | Two-layer with adjustable colors      | Tree icons, decorative elements    |

### Choosing a weight

- Use **regular** (`ph`) as the default
- Use **fill** (`ph-fill`) for solid/prominent icons (e.g., status indicators, active states)
- Use **light** (`ph-light`) for de-emphasized or secondary icons
- Use **bold** (`ph-bold`) for small icons that need extra visibility
- Use **duotone** (`ph-duotone`) when you need two-color styling (folders, files, decorative icons)

---

## Vendor Files

Icon CSS and font assets live in `studio/vendor/phosphor/`, with one subdirectory per weight:

```
studio/vendor/phosphor/
├── regular/   (ph)
├── fill/      (ph-fill)
├── duotone/   (ph-duotone)
├── light/     (ph-light)
└── bold/      (ph-bold)
```

Each weight directory contains `style.css` plus `.woff2`, `.woff`, `.ttf` font files. The CSS files are referenced in `electron-renderer.html` (local) and `public/index.html` (CDN).

---

## Registering Icons

Icons are registered via the Bifrost icon system (`IconMediator`). This decouples icon identity from the underlying framework.

### In your module's `onLoad` or initializer

```typescript
bifrost.icons.registerIcons({
  'my-module/action/save':    'ph ph-floppy-disk',
  'my-module/action/delete':  'ph ph-trash',
  'my-module/status/warning': 'ph-fill ph-warning',
  'my-module/tree/item':      'ph-duotone ph-file treeview__icon--ph-file',
});
```

Registering once allows reuse everywhere. The actual icon design only needs to happen at registration time.

### Naming convention

Follow the pattern `module-name/context/element`:

```
bpmn-editor/editor-tab/bpmn
engine-workspace/processes
std/tree/folder-open
```

### What can be registered

An icon value is either:

1. **A CSS class string** — rendered as `<span className="...">` (most common)
2. **A JSX element** — rendered directly (for custom SVGs)

```typescript
bifrost.icons.registerIcons({
  // CSS class string
  'my-ext/icon': 'ph-fill ph-star',

  // Inline SVG
  'my-ext/custom': (
    <svg viewBox="0 0 24 24">
      <path fill="currentColor" d="M12,2L2,22H22Z" />
    </svg>
  ),
});
```

---

## Using Icons in Components

### The `<Icon>` component

Import `Icon` from the host components alias:

```tsx
import { Icon } from '#components/Icon';

function MyComponent() {
  return (
    <div>
      {/* Renders the registered icon for this key */}
      <Icon id="my-module/action/save" />

      {/* You can also pass a raw Phosphor class string directly. Should be used sparingly. */}
      <Icon id="ph ph-gear" />
    </div>
  );
}
```

The `<Icon>` component:
- Looks up the `id` in the icon registry
- If found as a string, resolves the chain (icons can alias other icons)
- If found as JSX, renders it directly
- If not found, renders a `<span>` with the `id` as its `className`

This means you can use `<Icon id="ph ph-gear" />` without registering it first, but registering is preferred for consistency and maintainability.

> **Note:** The legacy pattern `const Icon = studio.icons.getComponent()` is deprecated. Always use the direct import instead. The direct import provides a stable module-level reference, which allows the React Compiler to statically verify the component identity and optimize renders.

---

## Utility Classes

The Studio provides custom utility classes (defined in `phosphor-utilities.scss`) since Phosphor does not ship with built-in transform or animation utilities. All utilities correctly handle duotone's `::before`/`::after` pseudo-elements (see "Duotone spin implementation" below for animation-specific handling).

### Sizing

| Class    | Effect          |
|----------|-----------------|
| `ph-lg`  | 1.333em         |
| `ph-2x`  | 2em             |
| `ph-3x`  | 3em             |
| `ph-5x`  | 5em             |

```typescript
'my-ext/big-warning': 'ph-fill ph-warning ph-3x'
```

Alternatively, use CSS `font-size` directly on the icon element or its parent — Phosphor icons scale with font size.

### Rotation

| Class           | Effect       |
|-----------------|--------------|
| `ph-rotate-90`  | 90° CW       |
| `ph-rotate-180` | 180°         |
| `ph-rotate-270` | 270° CW      |

```typescript
// The BPMN file icon: a git-branch icon rotated 90°
'bpmn/editor-tab/bpmn': 'ph-fill ph-git-branch ph-rotate-90 bpmn__editor--tab-icon'
```

### Flipping

| Class       | Effect              |
|-------------|---------------------|
| `ph-flip-h` | Horizontal mirror   |
| `ph-flip-v` | Vertical mirror     |

```typescript
// A mirrored search icon for the left menu bar
'std/left-pane-item/search': 'ph-bold ph-magnifying-glass ph-flip-h'
```

### Animation

| Class      | Effect                                   |
|------------|------------------------------------------|
| `ph-spin`  | Smooth continuous rotation (2s cycle)    |
| `ph-pulse` | Stepped rotation (8 steps, 1s cycle)     |

```typescript
// A spinning loader
'std/tree/loading': 'ph-duotone ph-spinner-gap ph-spin'
```

> **Note:** Do not combine rotation/flip utilities with animation utilities on the same element, as both use the `transform` property.

#### Duotone spin implementation

For single-layer weights (`ph`, `ph-light`, `ph-bold`, `ph-fill`), `.ph-spin` applies `animation: ph-spin` directly to the element. For `ph-duotone`, the animation is handled differently: the element-level animation is disabled (`animation: none`), and the rotation is applied to `::before` and `::after` individually. This is necessary because duotone icons render two overlapping pseudo-elements (the `::after` uses `margin-left: -1em` to overlay `::before`), which causes Chromium to compute the element's box wider than the visible glyph. Rotating the element directly would orbit around the wrong center. The pseudo-element animation avoids this because each pseudo-element rotates around its own center, and both share the same visual origin.

---

## Duotone Coloring

Duotone icons render two layers: `::before` (background, 20% opacity) and `::after` (foreground, full opacity). Both inherit `color` by default and Phosphor itself has no color variable support.

The Studio bridges this via `phosphor-utilities.scss`, which wires three CSS custom properties into Phosphor's pseudo-elements with `!important` to override the per-icon specificity:

| Variable                  | Applies to                      | Default       |
|---------------------------|---------------------------------|---------------|
| `--icon-primary-color`    | Foreground layer (`::after`)    | inherited     |
| `--icon-secondary-color`  | Background layer (`::before`)   | inherited     |
| `--icon-secondary-opacity`| Background layer opacity        | `0.2`         |

When none of these variables are set, the icon renders in the inherited `color` with the background layer at 20% opacity — the standard Phosphor duotone look.

### Setting duotone colors via CSS

Define the variables on the icon element or any ancestor:

```scss
// A golden folder icon (both layers fully opaque)
.treeview__icon--ph-folder {
  --icon-primary-color: goldenrod;
  --icon-secondary-color: #755911;
  --icon-secondary-opacity: 1;
}
```

```typescript
// Register the icon with the CSS class that carries the color variables
'std/tree/folder-closed': 'ph-duotone ph-folder treeview__icon--ph-folder'
```

### Setting duotone colors via inline styles

You can also set the variables as inline styles in JSX:

```tsx
<span
  className="ph-duotone ph-circle"
  style={{
    '--icon-primary-color': '#4caf50',
    '--icon-secondary-color': '#1b5e20',
    '--icon-secondary-opacity': '1',
  } as React.CSSProperties}
/>
```

### Resetting duotone colors for selected states

When an icon is inside a selected/highlighted row, you typically want to override the colors to white:

```scss
.treeview__entry--selected .treeview__icon .ph-duotone {
  --icon-primary-color: #fff;
  --icon-secondary-color: #fff;
  --icon-secondary-opacity: 0.4;
}
```

---

## Custom CSS Classes

You can append any additional CSS class after the Phosphor classes. This is commonly used for component-specific styling:

```typescript
bifrost.icons.registerIcons({
  // Custom class for tree icon colors
  'std/tree/file': 'ph-duotone ph-file treeview__icon--ph-file',

  // Custom class for BPMN tab styling
  'bpmn/editor-tab/bpmn': 'ph-fill ph-git-branch ph-rotate-90 bpmn__editor--tab-icon',

  // Custom class for status bar appearance
  'std/status-bar/machine-sanctum': 'ph-duotone ph-copyright statusbar__icon-machine-sanctum',
});
```

The extra classes are simply appended to the rendered `<span>` element, allowing you to target them in SCSS for positioning, color overrides, margins, etc.

---

## Inline SVG Icons

When Phosphor's catalog doesn't have the icon you need, register an inline SVG:

```typescript
bifrost.icons.registerIcons({
  'my-module/custom-shape': (
    <svg viewBox="0 0 24 24">
      <path fill="currentColor" d="M12,2L2,22H22Z" />
    </svg>
  ),
});
```

Guidelines for inline SVGs:

- Use `fill="currentColor"` so the icon inherits text color
- Set a `viewBox` for proper scaling
- Keep paths minimal — avoid embedding large or complex graphics

---

## Composite Icons (Layered)

Phosphor has no CSS-based stacking mechanism. When you need an icon composed of multiple layered symbols (e.g., a gear with a smaller overlay icon), use an inline SVG that combines multiple Phosphor SVG paths.

### Pattern

```tsx
<svg viewBox="0 0 256 256" style={{ width: '1em', height: '1em' }}>
  {/* Background icon at full size, semi-transparent */}
  <path fill="currentColor" opacity="0.4" d="...gear SVG path..." />

  {/* Overlay icon, scaled down and positioned in the lower-right */}
  <g transform="translate(120,120) scale(0.55)">
    <path fill="currentColor" d="...bug SVG path..." />
  </g>
</svg>
```

### Real example from the codebase

The engine debugger tab icon overlays a bug on a gear:

```tsx
bifrost.icons.registerIcons({
  'EngineDebugger/document-type/MainView': (
    <svg viewBox="0 0 256 256" className="engine__debugger--tab-icon"
         style={{ width: '1em', height: '1em' }}>
      <path fill="currentColor" opacity="0.4" d="M128,80a48,48..." />
      <g transform="translate(120,120) scale(0.55)">
        <path fill="currentColor" d="M168,92a12,12..." />
      </g>
    </svg>
  ),
});
```

### Compositing tips

- Use `opacity="0.4"` on the background path for a visual hierarchy similar to duotone
- The `translate(120,120) scale(0.55)` positions the overlay in the bottom-right quadrant
- For a horizontally flipped overlay, use `scale(-0.55, 0.55)`
- For a rotated overlay, nest a `rotate(angle 128 128)` in the transform
- SVG paths for Phosphor icons use `viewBox="0 0 256 256"` — you can find them in the [Phosphor GitHub repository](https://github.com/phosphor-icons/core/tree/main/assets)
- For two-color composites (e.g., red prohibition sign over a camera), use different `fill` colors on separate paths:

```tsx
<svg viewBox="0 0 256 256" style={{ width: '1em', height: '1em' }}>
  <path fill="currentColor" d="...camera path..." />
  <path fill="Tomato" d="...prohibit path..." />
</svg>
```

---

## Key Files

| File | Purpose |
|------|---------|
| `studio/vendor/phosphor/` | Webfont assets (CSS + font files per weight) |
| `studio/src/bifrost/styles/phosphor-utilities.scss` | Utility classes (spin, rotate, flip, sizing, duotone bridge) |
| `studio/src/bifrost/common/IconMediator.ts` | Icon registry and retrieval logic |
| `studio/src/components/Icon.tsx` | `<Icon>` rendering component (host registry instance) |
| `studio/src/modules/std/initializers/initializeIcons.tsx` | Central icon registrations |

### All available utility classes

| Class | Effect |
|-------|--------|
| `ph-spin` | Continuous rotation (2s) |
| `ph-pulse` | Stepped rotation (8 steps, 1s) |
| `ph-rotate-90` | Rotate 90° clockwise |
| `ph-rotate-180` | Rotate 180° |
| `ph-rotate-270` | Rotate 270° clockwise |
| `ph-flip-h` | Mirror horizontally |
| `ph-flip-v` | Mirror vertically |
| `ph-lg` | Scale to 1.333em |
| `ph-2x` | Scale to 2em |
| `ph-3x` | Scale to 3em |
| `ph-5x` | Scale to 5em |

### Duotone CSS variables

| Variable | Layer | Default |
|----------|-------|---------|
| `--icon-primary-color` | Foreground (`::after`) | `inherit` |
| `--icon-secondary-color` | Background (`::before`) | `inherit` |
| `--icon-secondary-opacity` | Background opacity | `0.2` |
