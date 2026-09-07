# FEEL Expression Editor

The Studio provides two CodeMirror 6-based editor components for FEEL (Friendly Enough Expression Language) expressions, wrapping the `@bpmn-io/feel-editor` library. Generic source editing (`MultiLineCodeEditor`, `DiffEditor`) is a separate host-only CodeMirror 6 kit — see [code-editors.md](code-editors.md). Do not fold FEEL into the generic wrappers.

## Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `FeelEditor` | `studio-sdk/src/components/FeelEditor.tsx` | Multi-line FEEL expression editor with syntax highlighting, autocomplete, and linting |
| `OneLineFeelEditor` | `studio-sdk/src/components/OneLineFeelEditor.tsx` | Single-line constrained variant for inline condition expressions |
| `FeelEditorTheme` | `studio-sdk/src/components/FeelEditorTheme.ts` | CodeMirror 6 theme extension referencing `--theme-feel-*` CSS custom properties |
| Theme tokens | `studio/src/components/feel-editor/component.feel-editor.scss` | Light/dark `--theme-feel-*` CSS custom property definitions |
| Ambient types | `studio/src/packages.d.ts`, `studio-sdk/packages.d.ts` | TypeScript declarations for `@bpmn-io/feel-editor` (ships no `.d.ts`) |

## Component Architecture

Both components follow the same class-wrapper + inner-functional-component pattern used by the host CodeMirror editors:

```
FeelEditor (class component)
  ├── exposes imperative API: focus(), getCurrentValue(), resetValue()
  ├── stores editorInstance ref
  └── renders FeelEditorInner (functional component)
        ├── useRef for container div
        ├── useEffect: instantiates @bpmn-io/feel-editor on mount
        ├── useEffect: watches `variables` prop → setVariables()
        ├── useEffect: watches `placeholder` prop → setPlaceholder()
        ├── blur listener: fires onChange if value differs from initialValue
        └── cleanup: flushes dirty value, destroys CodeMirror view
```

### OneLineFeelEditor Specifics

The single-line variant passes additional CodeMirror extensions to constrain the editor:

- **Enter → blur**: Keymap intercepts Enter and blurs instead of inserting a newline
- **Paste newline stripping**: DOM event handler strips `\n`/`\r` from pasted text
- **Single-line CSS**: `maxHeight: 2rem`, `overflow: hidden`, `whiteSpace: nowrap`
- **Do not key the host wrapper on the live value.** `onChange` fires on blur. A `key={…${committedValue}}` remounts and destroys CodeMirror during the click that commits, which can leave a FEEL autocomplete overlay on the canvas. `PropertiesProcess` Correlation Key, User Task due date, HTTP auth header / response headers, Sequential MI loop break, and Correlation Retrieval Expression omit that key. Input / Output mapping **rows** use a WeakMap `rowId`, not `${source}->${target}`.
- **Escape does not blur.** The one-line keymap maps Enter → blur. Escape only closes the autocomplete tooltip. Tests that then click the canvas must send `['Escape', 'enter']`. `StudioAgentBpmnExtension` canvas helpers also blur `document.activeElement` and wait for `.cm-tooltip` to unmount, because `setVariables` (async FEEL context) can reopen the tooltip while the editor is still focused.

## Props

### FeelEditorProps

| Prop | Type | Description |
|------|------|-------------|
| `studio` | `Studio` | Studio instance for theming and services |
| `initialValue` | `string` | Initial editor content |
| `dialect` | `'expression' \| 'unaryTests'` | FEEL dialect (default: `'expression'`) |
| `variables` | `FeelEditorVariable[]` | Variables for autocomplete context |
| `onChange` | `(value: string) => void` | Fires on blur if value changed |
| `onKeyDown` | `(event: KeyboardEvent) => boolean \| void` | Key event handler |
| `onLint` | `(diagnostics: unknown[]) => void` | Lint results callback |
| `autoFocus` | `boolean` | Focus on mount |
| `className` | `string` | Additional CSS class |
| `size` | `'small' \| 'medium' \| 'tall'` | Predefined height (multi-line only) |
| `fontSize` | `number` | Font size override |
| `readOnly` | `boolean` | Read-only mode |
| `placeholder` | `string` | Placeholder text |

### FeelEditorVariable

```typescript
type FeelEditorVariable = {
  name: string;
  detail?: string;
  info?: string | (() => HTMLElement);
  isList?: boolean | 'optional';
  entries?: FeelEditorVariable[];
  type?: 'function' | 'variable';
  params?: Array<{ name: string; type?: string }>;
};
```

The `entries` field supports nested structures for autocomplete drill-down (e.g., `token.customer.name`).

## Theming

The FEEL editor integrates with the Studio's CSS custom property theming system:

1. **SCSS tokens** (`component.feel-editor.scss`) define `--theme-feel-*` variables under `.bifrost.bifrost-theme--light` and `--dark`
2. **CodeMirror theme** (`FeelEditorTheme.ts`) uses `EditorView.theme()` to reference those CSS variables
3. `EditorView.theme()` takes precedence over the library's built-in `EditorView.baseTheme()`, so our overrides win
4. Theme switching happens at the CSS level — no JavaScript reconfiguration needed

### Token Map

| Token | Light | Dark | Purpose |
|-------|-------|------|---------|
| `--theme-feel-bg` | `var(--theme-input-bg)` | `var(--theme-input-bg)` | Editor background |
| `--theme-feel-fg` | `var(--theme-fg)` | `var(--theme-fg)` | Default text color |
| `--theme-feel-variable` | `#1a1aa6` | `#9cdcfe` | Variable name syntax |
| `--theme-feel-number` | `#116644` | `#b5cea8` | Number literal syntax |
| `--theme-feel-string` | `#aa1111` | `#ce9178` | String literal syntax |
| `--theme-feel-bool` | `#221199` | `#569cd6` | Boolean literal syntax |
| `--theme-feel-function` | `#aa3731` | `#dcdcaa` | Function name syntax |
| `--theme-feel-keyword` | `#770088` | `#c586c0` | Keyword syntax |
| `--theme-feel-tooltip-*` | (various) | (various) | Autocomplete tooltip |

## Dependency Chain

```
@bpmn-io/feel-editor (peer dep of SDK, devDep of studio)
  ├── @bpmn-io/lang-feel       — CodeMirror 6 FEEL language package
  ├── @bpmn-io/feel-lint        — FEEL linting
  ├── @camunda/feel-builtins    — Built-in FEEL function definitions
  ├── @codemirror/autocomplete  — Autocompletion framework
  ├── @codemirror/commands       — Default keybindings
  ├── @codemirror/language       — Language support infrastructure
  ├── @codemirror/lint           — Lint framework
  ├── @codemirror/state          — Editor state
  ├── @codemirror/view           — Editor view
  ├── @lezer/highlight           — Syntax highlighting
  └── mitt                       — Event emitter
```

The library is ESM-only. The SDK tsconfig uses `"module": "ESNext"` and `"moduleResolution": "bundler"`, and Rspack handles ESM resolution natively.

## FEEL Expression Context Command

**Command ID**: `bpmn.feel.getExpressionContext`

Registered in `studio/src/modules/bpmn-editor/initializers/initializeFeelContextCommands.ts`. Returns a `FeelEditorVariable[]` array representing the ThomasTheDaemonEngine's FEEL expression context.

The command is universally callable. It accepts an optional `EditorDocument` parameter:

- **With a BPMN document**: Returns static engine variables plus diagram-derived data object variables
- **Without arguments**: Returns only the static engine variables (used by Machine Sanctum and any non-BPMN context)

This makes the command safe to call from any module without requiring an active BPMN editor.

### Context Variables

| Variable | Type | Sub-properties |
|----------|------|---------------|
| `token` | dynamic | Arbitrary payload — shape depends on runtime data |
| `this` | static | `id`, `name`, `type` (flow node metadata) |
| `context` | dynamic | Initial input values (process variables) |
| `process` | static | `id`, `name`, `version` |
| `processInstance` | static | `id`, `businessKey`, `startedAt`, `startedBy`, `parentId` |
| `identity` | static | `id`, `roles`, `groups`, `claims` |
| `loop` | static | `index`, `total`, `completed`, `results` |
| `dataObjects` | diagram-derived | Keys from BPMN Data Object references in the diagram |

The variable names use FEEL-side camelCase conventions, matching the engine's `Expressions.Context.to_feel_scope/1` output.

## FEEL Simulator Component

`studio/src/components/feel-simulator/` provides a reusable composite component that combines FEEL expression editing with live evaluation. It is used by:

1. **BPMN fragment renderers** — every "Open in New Tab" FEEL property tab shows the simulator instead of a plain editor
2. **Machine Sanctum sandbox** — the `about:machine-sanctum/feel_editor` page as a document-free playground

### File Structure

| File | Purpose |
|------|---------|
| `types.ts` | Shared types: `FeelSimulatorLayout`, `FeelSimulatorProps`, `FeelSimulatorEditorRef`, `EvalResult`, `FeelWarning` |
| `FeelEvaluator.ts` | Web Worker lifecycle manager (create, evaluate, timeout, dispose) |
| `feel-eval-worker.ts` | Worker script: evaluates FEEL via `@bpmn-io/feelin`, serializes non-cloneable result types |
| `ResultRenderer.tsx` | Displays evaluation results (idle, loading, success, error, timeout states) |
| `ExecuteButton.tsx` | Run button triggering evaluation |
| `FeelSimulatorEditor.tsx` | Main composite component (expression editor + variable values JSON + result) |
| `component.feel-simulator.scss` | BEM-style layout (CSS custom property-based theming) |
| `index.ts` | Barrel export |

### Layout Modes

The `layout` prop controls which expression editor variant is rendered:

| `layout` | Expression editor shown | Consumer |
|----------|------------------------|----------|
| `'MultiLine'` | `FeelEditor` (full multi-line CodeMirror) | Fragment renderers (assignees, HTTP body, conditions, scripts, etc.) |
| `'SingleLine'` | `OneLineFeelEditor` | Future single-line fragment renderers |
| `'Both'` | Both editors stacked vertically | Machine Sanctum sandbox |

The bottom area (Variable Values JSON editor + Result renderer) is identical in all three modes.

### Props

```typescript
type FeelSimulatorLayout = 'SingleLine' | 'MultiLine' | 'Both';

type FeelSimulatorProps = {
  studio: Studio;
  initialExpression: string;
  variables: FeelEditorVariable[] | null;
  onChange: (expression: string) => void;
  layout: FeelSimulatorLayout;
  onKeyDown?: (event: KeyboardEvent) => boolean | void;
  autoFocus?: boolean;
  dialect?: 'expression' | 'unaryTests';
  htmlId?: string;
  htmlAttributes?: Record<string, unknown>;
  className?: string;
};
```

### Imperative API

The component exposes `FeelSimulatorEditorRef` via a React 19 `ref` prop:

```typescript
type FeelSimulatorEditorRef = {
  getCurrentValue(): string | undefined;
};
```

In `'MultiLine'` and `'Both'` mode, `getCurrentValue()` returns the multi-line editor's value. In `'SingleLine'` mode, it returns the single-line editor's value. This is used by `BpmnFragmentRendererView` for flush-on-navigate.

### Integration with Fragment Renderers

`BpmnFragmentRendererView.tsx` renders the simulator when `language === 'feel'`:

```tsx
<FeelSimulatorEditor
  ref={setSimulatorRef}
  studio={props.bifrost}
  initialExpression={props.fragmentValue ?? ''}
  onChange={props.onValueChange}
  variables={props.feelVariables ?? null}
  layout="MultiLine"
  autoFocus={true}
/>
```

All 9 FEEL fragment renderers inherit this automatically since they delegate to the shared view.

### Evaluation Architecture

Evaluation runs in a dedicated **Web Worker** (`feel-eval-worker.ts`) to isolate the main thread from pathological expressions that could freeze the Studio.

```
FeelSimulatorEditor.tsx
  └── FeelEvaluator (class, manages worker lifecycle)
        └── feel-eval-worker.ts (Web Worker)
              └── @bpmn-io/feelin evaluate()
```

Key behaviors of `FeelEvaluator`:

| Behavior | Detail |
|----------|--------|
| Persistent worker | One worker instance created on first use, reused for subsequent evaluations |
| Timeout | 5 s hard limit; worker is terminated via `worker.terminate()` on timeout |
| Lazy recreation | After termination, a new worker is created on the next evaluation |
| Result serialization | Worker converts non-cloneable types (Luxon DateTime/Duration, feelin Range, FunctionWrapper) to JSON-safe primitives before `postMessage` |
| Disposal | Component unmount calls `evaluator.dispose()` to terminate the worker |

### Variable Definitions vs. Variable Values

| Concern | Source | Purpose |
|---------|--------|---------|
| Definitions (`FeelEditorVariable[]`) | `bpmn.feel.getExpressionContext` command | Autocomplete context for FEEL editors |
| Values (`Record<string, unknown>`) | User-editable JSON in the Variable Values editor | Runtime evaluation context passed to `evaluate()` |

The Variable Values editor is pre-populated with a default context matching the engine's FEEL bindings (`token`, `this`, `context`, `process`, `processInstance`, `identity`, `loop`, `dataObjects`) with sample values, giving users immediate context for testing.

### Result Renderer States

| State | Visual | Trigger |
|-------|--------|---------|
| Idle | Muted italic text, grey left border | No evaluation has been run |
| Loading | Pulsing "Evaluating expression…" text, grey left border | Evaluation in progress (shown after 300 ms delay) |
| Success | Green left border, formatted value, type label, elapsed time, warnings | `evaluate()` returned successfully |
| Error | Red left border, error message, elapsed time | Expression is empty, JSON is invalid, or `evaluate()` threw |
| Timeout | Orange left border, timeout message | Worker did not respond within 5 s |

## Machine Sanctum Sandbox

`FeelEditorExamples.tsx` in the Machine Sanctum module provides a document-free FEEL sandbox.

Access via: `about:machine-sanctum/feel_editor`

It wraps the shared `FeelSimulatorEditor` component with `layout="Both"`, adding only a header/description. The sandbox is useful for:

- Learning FEEL syntax without needing an open BPMN diagram
- Prototyping complex expressions before pasting them into a property
- Testing edge cases (recursive structures, large lists, timeout behavior)
- Comparing multi-line and single-line expression behavior side-by-side
