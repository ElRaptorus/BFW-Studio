# Code Quality: Oxlint and Oxfmt

---

## Overview

The Studio enforces code quality through Oxlint (static analysis) and Oxfmt (formatting), both from the Oxc toolchain. `studio/` and `studio-sdk/` share one rule set in `oxlintrc.base.json` at the repository root; each package extends it from its own `.oxlintrc.json`. Oxfmt uses one shared root config, `.oxfmtrc.json`. Both tools are pinned to exact versions in each `package.json` because Oxfmt is pre-1.0 and its output can change between minor versions.

---

## Architecture

### Shared Base Config

**Path:** `oxlintrc.base.json` (repository root)

Plain JSON, consumed through `extends` by both packages. It enables rules explicitly (`categories.correctness` is `off`, so only listed rules run):

| Section | Content |
|---------|---------|
| `plugins` | `typescript`, `react` (the `react` plugin also provides the React Compiler rules) |
| `env` | `builtin`, `browser`, `node` |
| `settings.react.version` | `19.2.8` |
| `rules` | ESLint core and typescript-eslint recommended equivalents, the project's custom rules, the React Compiler rules, and the mapped React rules (see §Rules) |
| `overrides` | Turns off the core rules that TypeScript itself covers for `*.ts`/`*.tsx` |

### Per-Package Configs

| Package | Config path | Ignores | Module-boundary zones |
|---------|-------------|---------|-----------------------|
| `studio` | `studio/.oxlintrc.json` | `out/`, `dist/`, `test/fixtures/`, `node_modules/`, `build/`, `*.js`, `*.mjs`, `*.cjs` | Yes (see [imports-and-modules.md](imports-and-modules.md) §Module Dependency Direction) |
| `studio-sdk` | `studio-sdk/.oxlintrc.json` | `out/`, `node_modules/`, `*.js`, `*.mjs`, `*.cjs` | No |

A later entry in `overrides` replaces the `no-restricted-imports` option of an earlier matching entry; it does not merge. The studio config relies on this: the neutral-module zone (`src/modules/**`) is listed before the engine, bpmn and dmn zones, so those folders get their own pattern lists, and an `ignores` list per zone is not needed (Oxlint overrides have none).

### Oxfmt Configuration

**Path:** `.oxfmtrc.json` (repository root, shared across all packages)

| Setting | Value |
|---------|-------|
| `singleQuote` | `true` |
| `printWidth` | `120` |
| `trailingComma` | `all` |
| `arrowParens` | `always` |
| `sortPackageJson` | `false` |
| `ignorePatterns` | `studio/src/bifrost/common/EditorAreaManager.ts` (relative to the config file) |
| `sortImports` | `ignoreCase: false`; groups in order: `builtin`/`external`/`internal`/`subpath`/`unknown`, `react`, `@elraptorus/**`, `parent`/`sibling`/`index` |

The `format` script passes `-c ../.oxfmtrc.json` to reference the root config from within a package. `ignoreCase: false` reproduces the case-sensitive ordering of the former `@trivago/prettier-plugin-sort-imports`. Oxfmt lays out a union type that does not fit on one line with one member per line and a leading `|`.

---

## Rules

### Custom rules (beyond recommended presets)

| Rule | Severity | Purpose |
|------|----------|---------|
| `curly: ['error', 'all']` | error | Always require braces on control flow |
| `no-nested-ternary` | error | Prevent hard-to-read nested ternaries |
| `no-unneeded-ternary` | error | Simplify `x ? true : false` patterns |
| `id-length: min 2, checkGeneric: false` | warn | Enforce descriptive names (exceptions: `_`, loop vars; single-letter generic type parameters such as `T` are allowed) |
| `no-var` | error | Use `const`/`let` only |
| `prefer-const` | error | Use `const` when never reassigned |
| `typescript/array-type: 'array'` | warn | Use `T[]` not `Array<T>` |
| `typescript/no-unsafe-function-type` | error | Use specific signatures instead of `Function` |
| `typescript/consistent-type-imports` | error | Ban inline `import('...').Type` annotations; enforce `import type` for type-only imports |
| `react/jsx-key` | error | Missing `key`, key after a spread, fragment shorthand with key |
| `react/no-array-index-key` | error | Ban using a `.map` index as a React `key` |
| `react/no-unstable-nested-components` (`allowAsProps`) | error | No component definitions inside render; render props such as table column cells are allowed |
| `react/hook-use-state` | warn | `useState` must be destructured into value and setter named `[thing, setThing]` |

### Other React rules

The `react` plugin also enables these equivalents of the former `@eslint-react` recommended set: `no-danger`, `no-danger-with-children`, `no-find-dom-node`, `no-render-return-value`, `jsx-no-script-url`, `iframe-missing-sandbox`, `void-dom-elements-no-children`, `no-children-prop`, `jsx-no-comment-textnodes`, `no-namespace`, `no-react-children`, `no-clone-element`, `no-unsafe` (with `checkAliases`), `no-direct-mutation-state`, `no-will-update-set-state`.

### React Compiler rules

The project enables the React Compiler rules of the `react-hooks` v7 recommended ruleset, implemented natively by Oxlint's `react` plugin (`rules-of-hooks`, `exhaustive-deps`, `static-components`, `use-memo`, `preserve-manual-memoization`, `incompatible-library`, `immutability`, `globals`, `refs`, `set-state-in-effect`, `error-boundaries`, `purity`, `set-state-in-render`, `unsupported-syntax`). Existing `react-hooks/<rule>` names in disable comments are still honoured:

| Rule | What it enforces |
|------|-----------------|
| `react/rules-of-hooks` | Hooks called unconditionally, same order every render |
| `react/exhaustive-deps` | All reactive values in dependency arrays |
| `react/set-state-in-effect` | No synchronous `setState` inside effects |
| `react/refs` | No `ref.current` access during render |
| `react/static-components` | JSX components must be stable references |
| `react/purity` | Render functions must be pure |
| `react/immutability` | No mutation of props, state, or values derived from them |

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
| `typescript/no-explicit-any` | Gradual typing; strict `any` ban not practical yet |
| `typescript/ban-ts-comment` | `@ts-ignore` sometimes needed for SDK interop |
| `typescript/no-require-imports` | Electron main process uses `require` |
| `no-async-promise-executor` | Used in legacy patterns |
| `no-console` | Electron app logs to stdout |
| `react/no-did-mount-set-state`, `react/no-did-update-set-state` | Flag guarded `setState` calls in class components (resetting state when `resetKeys` change, storing a load error in a `catch`) that are valid React |

### Rules not covered

The move from ESLint dropped the `@eslint-react` plugin. Oxlint has no built-in equivalent for these rules, so they are not enforced:

| Group | Rules |
|-------|-------|
| Removed or deprecated React DOM APIs | `dom-no-flush-sync`, `dom-no-hydrate`, `dom-no-render`, `dom-no-use-form-state` |
| Leaked JSX text | `jsx-no-leaked-dollar`, `jsx-no-leaked-semicolon` |
| Naming | `naming-convention-context-name`, `naming-convention-id-name`, `naming-convention-ref-name` |
| Lazy `useState` initialization | `use-state` with `enforceLazyInitialization` (reported `useState(compute())`; `react/hook-use-state` checks naming only) |
| Legacy patterns | `no-access-state-in-setstate`, `no-context-provider`, `no-create-ref`, `no-forward-ref`, `no-nested-lazy-component-declarations`, `no-unnecessary-use-prefix`, `no-use-context` |
| Leaked browser resources | `web-api-no-leaked-event-listener`, `-fetch`, `-intersection-observer`, `-interval`, `-resize-observer`, `-timeout` |

Also not available: `no-dupe-args` and `no-octal` (strict-mode TypeScript rejects both), `no-undef` (off for TypeScript anyway), `no-useless-assignment` (experimental in Oxlint), and the React Compiler `config`/`gating` rules (unused).

Review leaked-resource patterns (listeners, intervals, timeouts, observers, fetch) manually: effects must clean up what they start.

### Differences from the ESLint behaviour

Some mapped rules check more or less than their `@eslint-react` counterparts:

| Rule | Difference |
|------|------------|
| `react/jsx-key` | Error for a missing `key`; `no-missing-key` was a warning (`jsx-no-key-after-spread` was already an error) |
| `react/no-children-prop` | Error for every `children` prop; `jsx-no-children-prop` was a warning when no JSX children were present |
| `react/no-unsafe` | Error for `UNSAFE_componentWill*`; `no-unsafe-component-will-*` were warnings |
| `react/no-unstable-nested-components` | Does not report a component function created inside `useMemo` |
| `no-unused-vars` | Does not report an unused type parameter of an interface inside `declare module` |

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

Assigning `ref.current = value` during render triggers `react/refs`. The `useEffect` approach keeps the ref in sync after each render without violating the rule.

### Ref as a prop (React 19)

SDK and Studio components that accept a ref from consumers declare `ref` on the props type and destructure it in the function signature. Do not use `React.forwardRef` (no longer lint-enforced). Do not use a custom `htmlRef` prop (`react/refs`).

```typescript
type MyProps = React.PropsWithChildren<{
  ref?: React.Ref<HTMLDivElement>;
}>;

export function MyComponent({ ref, children }: MyProps): React.JSX.Element {
  return <div ref={ref}>{children}</div>;
}
```

Destructure `ref` out of the props object (`{ ref, ...props }` or `{ ref: forwardedRef, ... }`). Reading `props.ref` during render trips `react/refs`.

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
// eslint-disable-next-line react/set-state-in-effect -- useLayoutEffect DOM measurement; runs before paint
setPosition({ x: finalX, y: finalY });
```

Always: (1) use `eslint-disable-next-line`, not block disables; (2) specify the exact rule; (3) add a `--` justification. Oxlint honours `eslint-disable` comments, so the prefix stays. Use `react/<rule>` names for rules that had an `@eslint-react/` name before. The lint scripts pass `--report-unused-disable-directives`, so a comment that no longer suppresses anything is reported.

The comment must sit on the line directly above the reported line, which inside a multi-line expression is not always the first line of the statement.

---

## Scripts

Both packages provide identical script names:

| Script | studio command | studio-sdk command |
|--------|---------------|-------------------|
| `npm run lint` | `oxlint --report-unused-disable-directives src test` | `oxlint --report-unused-disable-directives src` |
| `npm run lint:fix` | `oxlint --fix --report-unused-disable-directives src test` | `oxlint --fix --report-unused-disable-directives src` |
| `npm run format` | `oxfmt -c ../.oxfmtrc.json src test` | `oxfmt -c ../.oxfmtrc.json src` |

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
| Shared base config | `oxlintrc.base.json` (repo root) |
| Studio Oxlint config | `studio/.oxlintrc.json` |
| SDK Oxlint config | `studio-sdk/.oxlintrc.json` |
| Oxfmt config | `.oxfmtrc.json` (repo root) |
| Studio scripts | `studio/package.json` → `scripts.lint`, `scripts.lint:fix`, `scripts.format` |
| SDK scripts | `studio-sdk/package.json` → `scripts.lint`, `scripts.lint:fix`, `scripts.format` |
