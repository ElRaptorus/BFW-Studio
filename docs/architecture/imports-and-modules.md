# Imports and Module Resolution

The Studio uses TypeScript 6.0 with `moduleResolution: "bundler"` and **subpath imports** to eliminate deep relative paths across major source boundaries.

## Subpath Import Aliases

Defined in `studio/package.json` under the `"imports"` field:

| Alias | Resolves to | Purpose |
|-------|-------------|---------|
| `#bifrost/*` | `./src/bifrost/*` | Core framework (Bifrost, mediators, managers, contracts) |
| `#components/*` | `./src/components/*` | Shared internal React components |
| `#modules/*` | `./src/modules/*` | Cross-module imports (e.g., `engine-workspace` importing from `engine-core`) |

TypeScript resolves these via a matching `paths` entry in `tsconfig.base.json`; Rspack resolves them via the `imports` field in `package.json` at bundle time.

### Usage Rules

- **Cross-boundary imports** (file in `modules/` importing from `bifrost/` or `components/`) **must** use subpath aliases.
- **Cross-module imports** (file in `modules/A` importing from `modules/B`) **must** use `#modules/B/...`.
- **Intra-module imports** (file importing from the same module, or within `bifrost/` at shallow depth) **should** stay relative (`./`, `../`).
- **SDK imports** use the `@elraptorus/bfw_studio_sdk` package specifier. Internal SDK paths (`../../../studio-sdk/src/...`) cannot use subpath imports (cross-package restriction) and remain relative for now.

### Examples

```typescript
// Cross-boundary: module → bifrost
import { Bifrost } from '#bifrost/Bifrost';
import { AbortablePromise } from '#bifrost/common/AbortablePromise';

// Cross-boundary: module → shared component
import { SplitterLayout } from '#components/splitter/SplitterLayout';

// Cross-module: engine-workspace → engine-core
import { getHumanizedDateTime } from '#modules/engine-core/Formatters';

// Intra-module (stays relative)
import { PropertiesPane } from './panes/PropertiesPane';
```

## Module Dependency Direction

The rule is `.cursor/rules/module-boundaries.mdc`. In short:

| Importer | Must not import |
|---|---|
| `bifrost/`, `components/` | any module (`ModuleManager`'s dynamic `require` loads them) |
| neutral modules (every module outside the engine, bpmn and dmn families, e.g. `std`, `git-cruiser`) | `engine-*` |
| `bpmn-*` | `engine-*`, `git-cruiser`, every `dmn-*` except `dmn-core` |
| `dmn-*` | `engine-*`, `git-cruiser`, every `bpmn-*` except `bpmn-core` |

The `-core` exception exists because the Business Rule Task couples BPMN to DMN; the types and views both families share live in `bpmn-core` / `dmn-core`. Where an import is forbidden, use a command, a mediator event, or a contract in `bifrost/contracts/` (for example `PluginApiNamespace`, `MergeResolverHost`, `ModelChangeDigest`). Where generic code goes (`bifrost/common/` versus a module or `-core`, platform services) is the rule's "Where generic code goes" table. A pure function goes in `bifrost/common/` only when callers in at least two families need it unchanged.

**Enforcement:** `studio/eslint.config.mjs` builds one `no-restricted-imports` block per importer group (`moduleBoundaryZones`). Each block lists all its patterns, because flat config does not merge one rule across overlapping `files` blocks. `forbidModules(prefix)` yields two regexes per forbidden target: `^#modules/<prefix>` and `(^|/)\.\./(\.\./)*<prefix>` for relative sibling imports. A negative lookahead (`dmn-(?!core\b)`) allows the `-core` modules. The neutral block matches `src/modules/**` minus the three families, so a new module is covered without editing the config. `test/unit/bifrost/moduleBoundaryZones.test.ts` lints forbidden and allowed sample imports against the real config.

## Resolution Architecture

```
Source file: import '#bifrost/Bifrost'
       │
       ├── TypeScript (type checking)
       │   └── tsconfig.base.json → compilerOptions.paths["#bifrost/*"]
       │       → ["./src/bifrost/*"] → resolves to ./src/bifrost/Bifrost.ts
       │
       └── Rspack (bundling)
           └── studio/package.json → imports["#bifrost/*"]
               → "./src/bifrost/*" → resolves to ./src/bifrost/Bifrost.ts
```

Both paths produce the same result. The dual-mapping is necessary because TypeScript's `imports` field resolution (even with `moduleResolution: "bundler"`) does not perform extension appending on resolved targets, while `paths` does.

Vitest does not use `package.json` `imports` for these aliases. Tests get a third mapping in `studio/vitest.config.mts` (`#bifrost` → `src/bifrost`, and the same for `#components` / `#modules`). That file is `.mts` so Node loads it as ESM: `studio/package.json` stays CommonJS for Electron (`"main": "out/bundle-electron-main.js"`) and must not set `"type": "module"`. A `vitest.config.ts` in a CJS package is loaded as CommonJS, which Vite's native `configLoader` rejects. Use `import.meta.dirname` there, not `__dirname`.

## Ambient Module Declarations

`studio/src/packages.d.ts` declares types for non-TypeScript assets that Rspack handles via loaders:

| Pattern | Loader | Description |
|---------|--------|-------------|
| `*.scss`, `*.css` | `null-loader` / `css-loader` | Side-effect style imports |
| `*.svg`, `*.png`, `*.jpg`, `*.gif` | `asset/resource` | Image assets (export `string` URL) |
| `*.md`, `*.markdown` | `markdown-image-loader` | Markdown content (export `string`) |
| `*.txt` | `asset/source` | Plain text content |
| `*.bpmn` | `asset/source` | BPMN XML content |

TypeScript 6.0 defaults `noUncheckedSideEffectImports` to `true`, meaning every `import './Foo.scss'` must resolve to a known module. These declarations ensure such imports pass type checking.

## TypeScript Configuration

### Base Config (`tsconfig.base.json`)

Key settings for module resolution:

| Setting | Value | Reason |
|---------|-------|--------|
| `moduleResolution` | `"bundler"` | Supports `imports` field, `exports` field enforcement, extensionless imports |
| `module` | `"ESNext"` | ESM output for Rspack tree-shaking |
| `types` | `["node"]` | TS 6.0 defaults `types` to `[]`; `@types/node` must be explicitly included |
| `paths` | `{ "#bifrost/*": [...], ... }` | Subpath alias resolution for type checking |
| `skipLibCheck` | `true` | Avoids type-checking third-party `.d.ts` files |

### Per-Target Configs

| Config | Scope | Notes |
|--------|-------|-------|
| `tsconfig.electron-renderer.json` | `src/` except `src/bifrost/electron-main` and tests | Renderer checker. `src/tsconfig.json` extends it, so the editor uses the same project. Web workers are included. |
| `tsconfig.electron-main.json` | `src/` except `src/bifrost/electron-renderer` and tests | Main-process and plugin-host checker. `src/bifrost/electron-main/tsconfig.json` extends it. |
| `studio-sdk/tsconfig.json` | SDK sources | Emits `.d.ts` declarations to `out/` |

`src/bifrost/electron-renderer/tsconfig.json` is a one-line extend of the renderer config so the editor does not stop at `src/tsconfig.json`. Web workers are type-checked by these two projects. `src/packages.d.ts` is part of `include: ["src"]`.
