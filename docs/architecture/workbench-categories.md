# Workbench Categories and Pages

The workbench is organised as categories (header buttons) that contain pages. Each page has its own editor area and its own pane groups. `CategoryManager` / `CategoryMediator` (`studio/src/bifrost/common/`, exposed as `bifrost.categories`) hold the registry and the active page. See [panes.md](panes.md), [editor-documents.md](editor-documents.md), and [plugin-manifest.md](plugin-manifest.md) for the consumers.

## Registry

| Item | Rules |
|---|---|
| Category | `id`, `label`, `icon`, `placement` (`start` \| `main` \| `end`), `order`. Ids match `[a-z][a-z0-9-]*`. |
| Page | `id` = `<categoryId>/<name>`, `categoryId`, `label`, `icon` (required, shown in the page bar), `order`, optional `defaultDocumentUri`, `editorTabsVisible` (default true; `false` hides the editor tab bar while the page holds at most one document), `paneAreas` (default all three; `[]` = none). Duplicate ids and prefix mismatches throw. |
| Hidden categories | A category without pages is hidden unless setting `workbench.categories.showEmpty` is true (default false). Activating a hidden category does nothing. |
| Hidden active category | `ensureActivePage` also leaves an empty active category that is not visible (for example after `showEmpty` is turned off) for the fallback page; `CategoryMediator.setShowEmptyCategories` calls it. |
| Unregistering | `unregisterPage` of the active page falls back to another page of the same category, or to no active page (emits `EVENT_WORKBENCH_PAGE_ACTIVATED` either way). |

Built-in categories (registered by `std`, `initializeWorkbenchCategories.ts`): `home` (start), `design` / `measure` / `deploy` / `debug` (main), `control` (end). Built-in pages: `home/welcome`, `design/workspace`, `design/source`, `debug/engines`, `control/plugins`, `control/settings`, `control/machine-sanctum`, `control/about`.

`ACTIVE_PAGE = 'active'` (`contracts/WorkbenchTypes.ts`) means "the page that is currently active". Events live in `contracts/internal/WorkbenchEvents.ts` (`EVENT_WORKBENCH_PAGE_ACTIVATED`, ...). State is persisted in the `Categories` instance storage; state without the current `version` is ignored. Startup order in `Bifrost.postInitialize`: restore categories, `ensureActivePage('design/workspace')`, attach categories to panes, restore panes, restore editors.

## Editor routing (EditorMediator)

`EditorMediator` owns one `EditorAreaManager` per page, created lazily.

| Rule | Behaviour |
|---|---|
| R1 | Open or focus by URI: a document open on any page activates that page and is focused. Otherwise the page comes from the document type (`'active'` = current page); that page is activated and the document opens there. An unregistered page refuses the open with an error notification. |
| R2 | Operations on a document run on the manager that contains it. |
| R3 | Focus and layout operations run on the active page's manager. |
| R4 | Enumeration (`getOpenEditorDocuments`, URI lookup) spans all pages. |
| R5 | `getOpenEditorDocumentsOfPage(pageId)` and `getOpenEditorsOfPage(pageId)` (layout editors, i.e. tab groups) list one page; `getPageIdOfEditorDocument(editorDocument)` returns the page showing a document (the active page if it is not open). |

Page-local consumers of R5: the Open Editors pane (entries, title count and its close icon, scoped to the active page) and the tab-close commands `std.editor.closeOtherEditorDocuments`, `closeAllEditorDocuments` and `closeSavedEditorDocuments`, which act on the page of the given document, or else the active page. Save all, quit with unsaved documents, close by type and fragments closing with their parent stay on R4.

Closing never switches pages. After a focused document on the active page closes, `navigateToNextAvailableOpenDocument` picks the most recently viewed open document of the active page; when the page has none left, it calls `openDefaultDocumentOfActivePage()`, so a page with a `defaultDocumentUri` reopens it and other pages stay empty. A focused document closing on a background page leaves the active page alone; that page's `EditorAreaManager` refocuses a neighbour itself. `focusEditorDocumentAndWaitForVisible` activates the page of the document first, so save prompts (close and quit) show the document they ask about.

`EditorMediator.openDefaultDocumentOfActivePage()` runs on page activation, after restore, and after a close empties the active page: when the active page has a `defaultDocumentUri` and no open documents, it opens that URI. It is suppressed while a document open itself activates the page. `getViewData()` combines the editor area's tab visibility with the page's `editorTabsVisible`: a page with `editorTabsVisible: false` (`home/welcome`, `control/settings`, `control/machine-sanctum`, `control/about`) shows the tab bar again while it holds two or more documents (for example the Settings JSON editor or a help document), so every document stays reachable and its dirty marker visible. Documents restored from a page that is no longer registered move to the page of their document type (fallback `design/workspace`) via `EditorAreaManager.adoptEditorDocument`. This runs after all registered pages are deserialized, because deserializing replaces a page's layout.

Session format v2: `{ version: 2, pages: { <pageId>: <editor area> } }`; fallback page `design/workspace`.

## Panes

See [panes.md](panes.md) §Pages. Default assignment: explorer and search → `design/workspace`; git → `design/source`; engines and console → `debug/engines`; plugins and `plugin-console` → `control/plugins`; inspectors and right groups → all pages.

## Header

`components/header/WorkbenchHeader.tsx` renders, left to right:

| Group | Content |
|---|---|
| Start | Categories with placement `start` (Home), then the web hamburger (`bifrost.env.isWeb`) |
| Main | Categories with placement `main`, centered; they shrink first |
| End | Header menu bar items (Engine cluster, plugin items) filtered by `pages`, a divider, the layout toggles for the pane areas the page has, then categories with placement `end` (Control) |

Below the row sits the page bar when the active category has more than one page or `pageBar` menu bar items match the active page. The page buttons sit on the left; the `pageBar` items (filtered by `pages`) are right-pinned in `.workbench-page-bar__items`. The only built-in page bar item is the linter ruleset select ([bpmn-linter.md](bpmn-linter.md) §Ruleset Selector). `matchesPage` (`CategoryManager.ts`) matches an exact page id or `<categoryId>/*`. Page buttons show the page `icon` and label; the layout is anchored to `.app-layout` (`position: relative`) and `.app-layout[hidden]` is `display: none`. Clicks run `std.workbench.activateCategory` / `std.workbench.activatePage`. Test hooks: `data-category-id` and `data-page-id` on the buttons and on `.workbench-header-container`. Theme tokens: `--theme-workbench-header-*`, `--theme-workbench-page-bar-*`, falling back to `--theme-menu-bar-*`. Layout toggles, hamburger and the menu bar types: [workbench-layout.md](workbench-layout.md). The Engine cluster (shown on `design/*`, `deploy/*`, `debug/*`): [engine.md](engine.md).

### Category shortcuts and View › Go to

`initializeWorkbenchCategories.ts` exports `GO_TO_CATEGORY_COMMANDS` in header order and registers one command per category: `std.workbench.goToHome`, `goToDesign`, `goToMeasure`, `goToDeploy`, `goToDebug`, `goToControl`. Each runs `activateCategory` and has `enabledWhen: () => categories.isCategoryVisible(id)`, so a hidden category's shortcut does nothing and its menu entry is disabled. Keystrokes map to command names without arguments, hence one command per category. `initializeKeyBindings.ts` binds `alt-1…6` (windows, linux) and `cmd-alt-1…6` (macos) in the same order. Windows reports AltGr as Ctrl+Alt and `KeybindingsManager` maps the key by its key code, so a `ctrl-alt-<digit>` binding would swallow characters such as `@`, `#` or `²` on European layouts; `test/unit/std/categoryKeyBindings.test.ts` rejects such bindings. The View menu has the submenu `view/go-to` (`view/go-to/<categoryId>`) after `view/command-search`.

## Menu bar API

`MenuBarItemArea` is `'header' | 'pageBar'`, with optional `pages` (page ids or `<categoryId>/*`, validated by `registerMenuBarItem`). `header` is shared by built-in modules and plugins. `pageBar` is internal: the SDK type stays `'header'` and the plugin bridge rejects every other area. Menu bar modifiers search only the header list. Plugin modifiers are rejected at registration when their `insertAfter` / `insertBefore` target is not a header item, and `pane_content_toggle` items are rejected by the plugin bridge. `MenuBarManager.updateMenuBarItems` logs and skips any modifier that throws later (e.g. its target was disposed), so one modifier cannot break the menu bar; `'left'` / `'center'` / `'right'` are rejected with an error naming the replacement.

## Plugin API 2.0.0

`editorDocumentTypes[].page` required, left `panes[].pages` required, `paneToggles` removed, `registerWebviewDocumentType` requires `page`, `registerMenuBarItem(area, items, { pages })`. Plugin-contributed pages follow in a later phase.
