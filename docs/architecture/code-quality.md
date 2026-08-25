# Code Quality: ESLint and Prettier

---

## Overview

The Studio enforces code quality through ESLint (static analysis) and Prettier (formatting). Both `studio/` and `studio-sdk/` share a common set of custom rules defined in `eslint.config.base.mjs` at the repository root. Each package has its own `eslint.config.mjs` that imports the shared rules and composes them with package-specific file patterns and ignores. Prettier uses a shared root config with import sorting.

---

## Architecture

### Shared Base Config

**Path:** `eslint.config.base.mjs` (repository root)

Exports plain JS objects (no npm imports) consumed by both packages:

| Export | Content |
|--------|---------|
| `customRules` | All custom rule overrides (curly, id-length, TypeScript, React, etc.) |
| `reactSettings` | `{ 'react-x': { version: '19.2.8', importSource: 'react' } }` |
| `sharedGlobals` | `{ process: 'readonly' }` |

### Per-Package Configs

Each package has its own `eslint.config.mjs` that imports the shared exports and composes them with package-local npm packages (`eslint` 10, `@eslint/js`, `typescript-eslint`, `eslint-config-prettier`, `@eslint-react/eslint-plugin`, `eslint-plugin-react-hooks`, `globals`) and file patterns.

| Package | Config path | Files pattern |
|---------|------------|---------------|
| `studio` | `studio/eslint.config.mjs` | `src/**/*.{ts,tsx}`, `test/**/*.{ts,tsx}` |
| `studio-sdk` | `studio-sdk/eslint.config.mjs` | `src/**/*.{ts,tsx}`, `types/**/*.ts` |

Flat config using `defineConfig()` from `eslint/config`. Config objects are applied in this order:

```
┌──────────────────────────────────────────┐
│  1. Ignores (out/, dist/, …)             │
├──────────────────────────────────────────┤
│  2. js.configs.recommended               │
├──────────────────────────────────────────┤
│  3. tseslint.configs.recommended         │
├──────────────────────────────────────────┤
│  4. eslint-config-prettier               │  ← disables formatting rules
├──────────────────────────────────────────┤
│  5. @eslint-react recommended-typescript │
│     + disable-rsc                        │  ← Electron, not Next.js RSC
├──────────────────────────────────────────┤
│  6. eslint-plugin-react-hooks            │  ← compiler / Rules of React
│     + customRules                        │  ← re-enables curly, key warn
└──────────────────────────────────────────┘
```

The ordering is critical: `eslint-config-prettier` must come **before** the custom rules block. Prettier disables all formatting-conflicting rules (including `curly`). The custom rules block then re-enables the ones the project wants enforced. If `prettier` comes last, it silently overrides custom rules back to `off`.

`@eslint-react/eslint-plugin` replaces jsx-eslint `eslint-plugin-react` (that plugin does not support ESLint 10). Meta's `eslint-plugin-react-hooks` stays as the source of truth for compiler / Rules-of-React coverage. The `@eslint-react` compiler twins (`rules-of-hooks`, `exhaustive-deps`, `purity`, `set-state-in-effect`, `set-state-in-render`, `static-components`, `unsupported-syntax`, `use-memo`, `error-boundaries`) are turned **off** in `customRules` so existing `eslint-disable-next-line react-hooks/…` comments remain valid. Do **not** enable `disable-conflict-eslint-plugin-react-hooks` — that preset turns **off** `react-hooks/*`.

### Prettier Configuration

**Path:** `.prettierrc.json` (repository root, shared across all packages)

| Setting | Value |
|---------|-------|
| `singleQuote` | `true` |
| `printWidth` | `120` |
| `trailingComma` | `all` |
| `arrowParens` | `always` |
| Import sorting | `@trivago/prettier-plugin-sort-imports` |

The `format` script passes `--config ../.prettierrc.json` to reference the root config from within `studio/`.

---

## Rules

### Custom rules (beyond recommended presets)

| Rule | Severity | Purpose |
|------|----------|---------|
| `curly: ['error', 'all']` | error | Always require braces on control flow |
| `no-nested-ternary` | error | Prevent hard-to-read nested ternaries |
| `no-unneeded-ternary` | error | Simplify `x ? true : false` patterns |
| `id-length: min 2` | warn | Enforce descriptive names (exceptions: `_`, loop vars) |
| `no-var` | error | Use `const`/`let` only |
| `prefer-const` | error | Use `const` when never reassigned |
| `@typescript-eslint/array-type: 'array'` | warn | Use `T[]` not `Array<T>` |
| `@typescript-eslint/no-unsafe-function-type` | error | Use specific signatures instead of `Function` |
| `@typescript-eslint/consistent-type-imports` | error | Ban inline `import('...').Type` annotations; enforce `import type` for type-only imports |
| `@eslint-react/no-missing-key` | warn | Same policy as the former `react/jsx-key` |

### React Compiler rules

The project enables the full `react-hooks` recommended ruleset, which includes React Compiler rules:

| Rule | What it enforces |
|------|-----------------|
| `react-hooks/rules-of-hooks` | Hooks called unconditionally, same order every render |
| `react-hooks/exhaustive-deps` | All reactive values in dependency arrays |
| `react-hooks/set-state-in-effect` | No synchronous `setState` inside effects |
| `react-hooks/refs` | No `ref.current` access during render |
| `react-hooks/static-components` | JSX components must be stable references |
| `react-hooks/purity` | Render functions must be pure |
| `react-hooks/immutability` | No mutation of props, state, or values derived from them |

### bpmn.io typing conventions

The bpmn.io libraries (diagram-js, bpmn-js) now ship full TypeScript declarations. Adapter classes in `bpmn-core/` import and return these types from their service getters. Key import paths and types:

| Import path | Type | Used for |
|-------------|------|----------|
| `diagram-js/lib/core/Canvas` | `Canvas`, `CanvasViewbox` | Viewport control, zoom, viewbox |
| `diagram-js/lib/core/ElementRegistry` | `ElementRegistry` | Element lookup; `get()` returns `ElementLike \| undefined` |
| `diagram-js/lib/core/EventBus` | `EventBus`, `Event` | Event subscription; alias `Event as DjsEvent` to avoid conflicts |
| `diagram-js/lib/features/selection/Selection` | `Selection` | Selection management; `get()` returns `any[]` |
| `diagram-js/lib/features/overlays/Overlays` | `Overlays` | Overlay management; `get()` returns `Overlay \| Overlay[]` |
| `diagram-js/lib/features/modeling/Modeling` | `Modeling` | Modeling operations (BPMN-specific extras like `setColor` require `as any`) |
| `diagram-js/lib/features/editor-actions/EditorActions` | `EditorActions` | Editor action triggers; `trigger(action, opts)` requires both args |
| `diagram-js/lib/features/clipboard/Clipboard` | `Clipboard` | Clipboard get/set |
| `diagram-js/lib/command/CommandStack` | `CommandStack` | Undo/redo, command registration |
| `diagram-js/lib/model/Types` | `ElementLike`, `Shape`, `Connection`, `Root`, `Label` | Element model types |
| `diagram-js/lib/util/Types` | `Rect`, `Point`, `Dimensions` | Geometry primitives |
| `bpmn-js/lib/Viewer` | `Viewer` | Viewer instance type |
| `bpmn-js/lib/Modeler` | `Modeler` | Modeler instance type |
| `bpmn-js/lib/NavigatedViewer` | `NavigatedViewer` | Navigable viewer instance type |
| `didi` | `Injector` | Diagram-js DI container |

**Untyped packages** use local `.d.ts` shims in `studio/src/types/`:
- `bpmn-js-differ` — diff API surface
- `diagram-js-minimap` — opaque module
- `diagram-js-grid` — opaque module
- bpmn-moddle — no types; moddle objects remain `any`

**`Canvas.viewbox(false)`**: The runtime API accepts `false` to force viewbox recomputation, but the TypeScript declaration only accepts `Rect | undefined`. Use `canvas.viewbox(false as any)` and cast the result to `CanvasViewbox`.

**`Overlays.get()`**: Returns `Overlay | Overlay[]`. Always normalize: `Array.isArray(result) ? result : [result]`.

### Rules intentionally disabled

| Rule | Reason |
|------|--------|
| `@typescript-eslint/no-explicit-any` | Gradual typing; strict `any` ban not practical yet |
| `@typescript-eslint/ban-ts-comment` | `@ts-ignore` sometimes needed for SDK interop |
| `@typescript-eslint/no-require-imports` | Electron main process uses `require` |
| `no-async-promise-executor` | Used in legacy patterns |
| `@eslint-react/rules-of-hooks` (and other compiler twins) | Official `react-hooks/*` owns compiler / Rules-of-React coverage |
| `@eslint-react/no-unused-class-component-members` | Class editor methods (`focus` / `getCurrentValue` / `resetValue`) are called via refs, which this rule cannot see |
| `no-console` | Electron app logs to stdout |

---

## Common Patterns

### Avoiding `set-state-in-effect`

When an effect synchronously calls `setState` with data available at render time, use one of:

1. **Lazy `useState` initializer** — compute initial state during first render:

```typescript
const [value, setValue] = useState(() => computeFromProps(props));
```

2. **Adjust state during render** — track previous props with state and update conditionally:

```typescript
const [prevProps, setPrevProps] = useState(props.data);
if (props.data !== prevProps) {
  setPrevProps(props.data);
  setDerived(computeFrom(props.data));
}
```

3. **`useLayoutEffect` for DOM measurement** — when `setState` depends on DOM dimensions, `useLayoutEffect` is correct (runs before paint). Suppress the lint warning with a justification comment.

### Latest-ref pattern

When a callback or effect needs to always see the latest props/state without re-subscribing, use a ref updated in a `useEffect` (not during render):

```typescript
const latestPropsRef = useRef(props);
useEffect(() => {
  latestPropsRef.current = props;
});
```

Assigning `ref.current = value` during render triggers `react-hooks/refs`. The `useEffect` approach keeps the ref in sync after each render without violating the rule.

### Ref as a prop (React 19)

SDK and Studio components that accept a ref from consumers declare `ref` on the props type and destructure it in the function signature. Do not use `React.forwardRef` (`@eslint-react/no-forward-ref`). Do not use a custom `htmlRef` prop (`react-hooks/refs`).

```typescript
type MyProps = React.PropsWithChildren<{
  ref?: React.Ref<HTMLDivElement>;
}>;

export function MyComponent({ ref, children }: MyProps): React.JSX.Element {
  return <div ref={ref}>{children}</div>;
}
```

Destructure `ref` out of the props object (`{ ref, ...props }` or `{ ref: forwardedRef, ... }`). Reading `props.ref` during render trips `react-hooks/refs`.

Components on this pattern: `EditorContent`, `PaneBody`, `MarkdownEditor`, `FeelSimulatorEditor`, `BpmnFragmentRendererView`, `PluginIframe`.

### Unconditional hook calls

React hooks must be called in the exact same order on every render. When a feature (e.g., drag-and-drop) is optional, call the hook unconditionally and disable it via configuration:

```typescript
const [{ isDragging }, drag] = useDrag(() => ({
  type: 'tree_item',
  canDrag: enableDragAndDrop,  // disables without skipping the hook
  ...
}), [enableDragAndDrop]);
```

### Suppressing rules

When suppression is unavoidable:

```typescript
// eslint-disable-next-line react-hooks/set-state-in-effect -- useLayoutEffect DOM measurement; runs before paint
setPosition({ x: finalX, y: finalY });
```

Always: (1) use `eslint-disable-next-line`, not block disables; (2) specify the exact rule; (3) add a `--` justification.

---

## Scripts

Both packages provide identical script names:

| Script | studio command | studio-sdk command |
|--------|---------------|-------------------|
| `npm run lint` | `eslint src/ test/` | `eslint src/ types/` |
| `npm run lint:fix` | `eslint --fix src/ test/` | `eslint --fix src/ types/` |
| `npm run format` | `prettier --write ... ./src ./test` | `prettier --write ... ./src ./types` |

Standard verification sequence after changes:

```bash
cd studio
npm run build
npm run lint:fix
npm run format
```

---

## File Path Reference

| Component | Path |
|-----------|------|
| Shared base config | `eslint.config.base.mjs` (repo root) |
| Studio ESLint config | `studio/eslint.config.mjs` |
| SDK ESLint config | `studio-sdk/eslint.config.mjs` |
| Prettier config | `.prettierrc.json` (repo root) |
| Studio scripts | `studio/package.json` → `scripts.lint`, `scripts.lint:fix`, `scripts.format` |
| SDK scripts | `studio-sdk/package.json` → `scripts.lint`, `scripts.lint:fix`, `scripts.format` |
