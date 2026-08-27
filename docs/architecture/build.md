# Build System

The Studio uses **Rspack** (a Rust-based, webpack 5-compatible bundler) for all build targets. Rspack was chosen over webpack for significantly faster build and watch cycle times while maintaining full configuration compatibility.

## Bundler: Rspack

- **Package**: `@rspack/core`, `@rspack/cli`
- **Config format**: webpack 5-compatible (same `module.rules`, `plugins`, `resolve`, `target` API)
- **Transpilation**: `builtin:swc-loader` (Rust-native SWC)
- **Type checking**: `ts-checker-rspack-plugin` — async (non-blocking) in development, synchronous in production
- **CSS extraction**: `rspack.CssExtractRspackPlugin`
- **Asset copying**: `rspack.CopyRspackPlugin`
- **Production minification**: `SwcJsMinimizerRspackPlugin` for JS (with `keep_classnames` for runtime reflection)

## Configuration Files

| File | Purpose |
|------|---------|
| `rspack.config.electron.js` | Main Electron build: composes all sub-configs into a multi-compiler array |
| `rspack.config.electron-main.js` | Electron main process, systeminformation worker, and webview bridge script |
| `rspack.config.css.js` | CSS bundle (SCSS → extracted CSS via glob) |

### Build-time Helpers

| File | Purpose |
|------|---------|
| `build/rspack/generate-build-info.js` | Generates `src/generatedBuildAndProductInfo.js` with version, commit hash, build date, release channel |

## Build Targets

The Electron build (`rspack.config.electron.js`) produces 7 bundles via multi-compiler:

| Config | Entry | Output | Target |
|--------|-------|--------|--------|
| CSS | `./src/**/*.scss` (glob) | `out/bifrost-styles.css` | `web` |
| Electron Main | `entrypoint-electron-main.ts` | `out/bundle-electron-main.js` | `electron-main` |
| Systeminformation | `Systeminformation.ts` | `out/Systeminformation.js` | `node` |
| Bridge Script | `bridge-script.ts` | `out/studio-bridge.js` | `web` |
| Plugin Host | `plugin-host-main.ts` | `out/plugin-host.js` | `node` |
| Sandbox Worker | `sandbox-worker.ts` | `out/sandbox-worker.js` | `node` |
| Electron Renderer | `entrypoint-electron-renderer.tsx` | `out/bundle-electron-renderer.js` + `out/imported-styles.css` | `electron-renderer` |

The CSS config uses a glob to compile all SCSS files into `bifrost-styles.css`, ensuring standalone styles (not imported by any TSX) are included automatically. The renderer config additionally extracts CSS from JS `import '*.css'` statements into `imported-styles.css`. Both are loaded by `electron-renderer.html`.

### Third-party CSS

Bootstrap 5 CSS is loaded via `import 'bootstrap/dist/css/bootstrap.min.css'` in `BootstrapInitializer.ts`. The renderer config's CSS extraction rule processes this import and includes it in `out/imported-styles.css`. No vendor CSS files or `<link>` tags are needed for Bootstrap.

**Loading order matters:** In `electron-renderer.html`, `imported-styles.css` (containing Bootstrap and other npm CSS) must load BEFORE `bifrost-styles.css` so that the Studio's SCSS can override Bootstrap's defaults. Reversing this order causes Bootstrap's aggressive resets to break the Studio layout.

## Key Build Scripts

| Script | Command |
|--------|---------|
| `npm run build` | Build SDK + Electron app |
| `npm run build:electron` | Clean + Rspack Electron build |
| `npm run build:electron:watch` | Rspack watch mode (no large heap flag needed — Rust core manages its own memory) |
| `npm start` | Launch `electron out/bundle-electron-main.js` |

## Loaders

| Loader | Purpose |
|--------|---------|
| `builtin:swc-loader` | TypeScript/JSX transpilation (Rust-native, no JS↔Rust IPC overhead) |
| `css-loader` | CSS module resolution |
| `sass-loader` | SCSS compilation (CSS config). `sassOptions.charset` is `false` so Dart Sass does not emit a UTF-8 BOM per entry — see [common-pitfalls.md](common-pitfalls.md) §Sass BOM |
| `node-loader` | Native `.node` addon loading (macOS fsevents) |
| `null-loader` | Prevents processing of `.scss`, `.d.ts`, and `.test.ts` files in the renderer config (SCSS is compiled separately by the CSS config) |
| `markdown-image-loader` | Markdown file processing |

## Workers

Web Workers use the standard `new URL('./Worker.ts', import.meta.url)` pattern, which Rspack supports natively. Workers are split into separate chunks automatically.

## Conditional Compilation

Build-target-specific code uses the `__BIFROST_CLIENT__` constant, injected via `DefinePlugin` with a value of `'electron'`, `'embed'`, or `'webapp'`. The bundler inlines the constant, enabling dead code elimination in production. Currently only `modules/std/aboutpage/index.ts` uses this mechanism.

## Source Maps

- **Development**: `cheap-module-source-map` — line-level maps, faster to generate
- **Production**: `source-map` — full column-level maps

## Type Checking

`ts-checker-rspack-plugin` runs type checking in a background process:
- **Development** (`async: true`): non-blocking — the build completes immediately, type errors are reported afterwards
- **Production** (`async: false`): blocking — the build waits for type checking to finish, ensuring correctness

Two type checker instances exist: one for `tsconfig.electron-main.json` (main process scope) and one for `tsconfig.electron-renderer.json` (renderer scope).

## Production Builds

Production builds set `NODE_ENV=production`, which enables:
- JS minification via `SwcJsMinimizerRspackPlugin`
- Full source maps
- Blocking type checking
- Packaging via `electron-builder` (config in `build/electron-builder.js`). Linux `target` is AppImage; electron-builder also always writes `dist/electron/linux-unpacked/` (the ELF ChromeDriver uses in CI). Do not point WebDriver at the `.AppImage`.
