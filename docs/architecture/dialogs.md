# Dialog System

---

## Overview

The dialog system provides modal interaction for user decisions, form input, and native OS file pickers. Dialogs are queued — only one is visible at a time. If a second dialog is requested while one is active, it waits in a FIFO queue and activates automatically when the current one closes.

The system has two dialog families:

- **Custom dialogs** — Rich HTML/React-based forms rendered inside the application window. Support text inputs, path lists, code editors, checkboxes, selects, markdown, and more.
- **Native dialogs** — OS-native file/directory pickers and message boxes, dispatched via Electron IPC to the main process.

Both families flow through the same `DialogManager` queue, so they are mutually exclusive (a native dialog blocks custom dialogs and vice versa).

```
┌─────────────────────────────────────────────────────────────────────┐
│  Module code                                                      │
│    bifrost.dialog.open(options, validation?)                          │
│    bifrost.dialog.showSaveFile(options?)                              │
│    bifrost.dialog.showOpenFile()                                      │
│    bifrost.dialog.showOpenDirectory()                                 │
│    bifrost.dialog.prompt(title, placeholder?)                         │
├─────────────────────────────────────────────────────────────────────┤
│  DialogManager                                                       │
│    ├─ normalizeDialogOptions()                                       │
│    ├─ dialogQueue[]  (FIFO)                                          │
│    ├─ activeDialog                                                   │
│    └─ validation loop (EVENT_VALIDATED_DIALOG)                       │
├─────────────────────────────────────────────────────────────────────┤
│  DialogService (base)              DialogServiceElectron (extends)    │
│    emit EVENT_OPEN_DIALOG  ──┐       ├─ type === 'custom' → super    │
│    emit EVENT_CLOSE_DIALOG   │       ├─ type === 'open-file' → IPC   │
│                              │       ├─ type === 'open-directory' → …│
│                              │       ├─ type === 'save-file' → IPC   │
│                              │       └─ type === 'message-box' → IPC │
├──────────────────────────────┼──────────────────────────────────────┤
│  Workbench (React)           │                                       │
│    subscribes to events ◄────┘                                       │
│    renders DialogContainer                                           │
│      └─ DialogRenderer (content type switch)                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## DialogManager

**Path:** `studio/src/bifrost/common/DialogManager.ts`
**SDK type declaration:** `studio-sdk/types/common/DialogManager.ts`
**Exposed as:** `bifrost.dialog`

The central orchestration class. Manages the queue, normalization, validation loop, and public API.

### Internal State

| Field | Type | Purpose |
|-------|------|---------|
| `dialogQueue` | `Dialog[]` | FIFO queue of pending dialogs |
| `activeDialog` | `Dialog \| null` | Currently displayed dialog |
| `counter` | `number` | Auto-incrementing ID generator |

### Public Methods

| Method | Signature | Purpose |
|--------|-----------|---------|
| `open` | `open(options: DialogOptions, validation?: DialogValidationCallbackFn): Promise<DialogResult>` | Opens a custom or native dialog; returns when user responds |
| `prompt` | `prompt(title: string, placeholder?: string): Promise<string \| null>` | Convenience for a single text input dialog |
| `showOpenFile` | `showOpenFile(options?): Promise<string[] \| null>` | Native file picker (Electron only). Options: `title`, `defaultPath`, `message`, `filters`, `properties` |
| `showOpenDirectory` | `showOpenDirectory(options?): Promise<string[] \| null>` | Native directory picker (Electron only). Options: `defaultPath` |
| `showSaveFile` | `showSaveFile(options?): Promise<string \| null>` | Native save dialog (Electron only). Options: `title`, `defaultPath`, `buttonLabel`, `filters` |

All three resolve `defaultPath` through the [default path tracking](#default-path-tracking) chain before opening, and record the used directory afterwards.
| `close` | `close(): void` | Programmatically closes the active dialog (cancels it) |
| `isActive` | `isActive(): boolean` | Whether a dialog is currently displayed |

### Queue Lifecycle

1. `open()` is called → options are normalized → a `Dialog` object is created with a unique ID and a response callback
2. The `Dialog` is pushed to `dialogQueue`
3. `tryToActivateNextDialogFromQueue()` checks if `activeDialog` is `null`
   - If yes → shifts the next dialog from the queue, sets it as `activeDialog`, calls `dialogService.open(dialog)`
   - If no → the dialog waits in the queue
4. When the user responds → the response callback fires
   - If there is a validation callback → it is invoked with the `DialogResult`
     - `{ closeDialog: true }` → dialog closes, promise resolves with the result
     - `{ closeDialog: false, validationErrors }` → `EVENT_VALIDATED_DIALOG` is emitted, dialog stays open with errors displayed
   - If there is no validation callback → dialog closes immediately
5. On close → `activeDialog = null`, `dialogService.close()` is called, `tryToActivateNextDialogFromQueue()` activates the next queued dialog

### Normalization

`normalizeDialogOptions()` transforms the flexible `DialogOptions` input into the strict `DialogOptionsStrict` format:

- String actions (e.g. `'cancel'`) are expanded to `{ response: 'cancel', label: 'Cancel' }`
- String content (e.g. `'Are you sure?'`) is wrapped as `{ type: 'markdown', text: '...' }`
- The `type` field defaults to `'custom'` when omitted

---

## DialogService

**Path:** `studio/src/bifrost/common/DialogService.ts`

A minimal event emitter. Emits `EVENT_OPEN_DIALOG` and `EVENT_CLOSE_DIALOG`. The base class is used for non-Electron environments.

### DialogServiceElectron

**Path:** `studio/src/bifrost/electron-renderer/DialogServiceElectron.ts`

Extends `DialogService`. Overrides `open()` to intercept native dialog types before they reach the custom dialog renderer:

| Dialog Type | Handling | IPC Event |
|-------------|----------|-----------|
| `custom` | Falls through to `super.open()` → emits `EVENT_OPEN_DIALOG` → React renders it |
| `message-box` | `ipcRenderer.invoke(IPC_MESSAGE_SHOW_NATIVE_MESSAGE_BOX)` |
| `open-file` | `ipcRenderer.invoke(IPC_MESSAGE_SHOW_NATIVE_OPEN_FILE_DIALOG, options)` |
| `open-directory` | `ipcRenderer.invoke(IPC_MESSAGE_SHOW_NATIVE_OPEN_DIRECTORY_DIALOG, options)` |
| `save-file` | `ipcRenderer.invoke(IPC_MESSAGE_SHOW_NATIVE_SAVE_FILE_DIALOG, options)` |

Native dialogs bypass the React rendering pipeline entirely. Their result is fed back into the response callback with `formData: { filenames }` (for open) or `formData: { filename }` (for save).

---

## Dialog Events

**Path:** `studio-sdk/src/contracts/internal/DialogEvents.ts`

| Event | Emitted By | Payload | Purpose |
|-------|-----------|---------|---------|
| `EVENT_OPEN_DIALOG` | `DialogService` | `Dialog` | A custom dialog should be rendered |
| `EVENT_CLOSE_DIALOG` | `DialogService` | *(none)* | The active dialog should be removed |
| `EVENT_VALIDATED_DIALOG` | `DialogManager` | `DialogValidationResult` | Validation failed; update the dialog with error messages |

The sentinel response `DIALOG_RESPONSE_CANCEL` (value: `'dialog_cancelled_by_user'`) is used when the user clicks the X button. It bypasses action matching and produces `{ wasCancelled: true }`.

---

## React Rendering Pipeline

### Workbench

**Path:** `studio/src/components/Workbench.tsx`

The `Workbench` component subscribes to dialog events on `bifrost.dialog`:

```
EVENT_OPEN_DIALOG  → setDialog(dialog)
EVENT_CLOSE_DIALOG → setDialog(null)
EVENT_VALIDATED_DIALOG → setDialog({ ...dialog, validationResult })
```

When `dialog` is non-null, `<DialogContainer>` is rendered.

### DialogContainer (Dialog.tsx)

**Path:** `studio/src/components/dialog/Dialog.tsx`

Provides the modal wrapper:
- A focus trap (`focusin` listener redirects focus back to the modal if it escapes)
- The `modal show` backdrop overlay
- A `data-test--dialog` attribute for integration tests
- Delegates to `<DialogRenderer>` for content

### DialogRenderer

**Path:** `studio/src/components/dialog/DialogRenderer.tsx`

The main rendering component. Contains:

1. **Form data collection** (`formToPojo`) — Queries all `<input>`, `<select>`, `<textarea>` elements in the `<form>` node by `name` attribute. Checkboxes use `element.checked`; everything else uses `element.value`. Code editors (`json`, `diff`) contribute values via `codeEditorRef.current.getCurrentValue()`.

2. **Enter-to-submit** — A `submit` event listener on the `<form>` triggers the `default` action. A 1ms delay prevents accidental submission when the dialog is opened via Enter in the command search.

3. **Content type switch** — Maps each `DialogContentObject` to a React component:

| Content Type | React Component | Form Integration |
|--------------|-----------------|------------------|
| `text_input` | `DialogContentTextInput` | `<input>` or `<textarea>` with `name={id}` |
| `path_list` | `DialogContentPathList` | `<input type="hidden" name={id} value={JSON.stringify(paths)}>` |
| `path_picker` | `DialogContentPathPicker` | `<input type="hidden" name={id} value={selectedPath}>` (plain string) |
| `select` | `DialogContentSelect` | `<select name={id}>` |
| `checkbox` | `DialogContentCheckbox` | `<Checkbox>` with `htmlId={id}` |
| `json` | `DialogContentJson` | Monaco `MultiLineCodeEditor` with `name={id}` |
| `diff` | `DialogContentDiff` | Monaco `DiffEditor` with `name={id}` |
| `markdown_container` | `DialogContentMarkdownEditor` | Read-only `MarkdownEditor` |
| `markdown` | `DialogContentMarkdown` | Rendered via `marked()` |
| `text` | `DialogContentText` | Plain `<p>` |
| `section` | `DialogContentSection` | Section header |
| `divider` | `DialogContentDivider` | Horizontal rule |
| `response_link` | `DialogContentResponseLink` | Clickable card, triggers `responseCallback(response)` directly |
| `key_value_builder` | `DialogContentKeyValueBuilder` | `<input type="hidden" name={id} value={JSON.stringify(entries)}>` (JSON array of `{key, value}` string pairs) |

4. **Action buttons** — Each `DialogActionObject` renders as a `<button>`. The `default` action gets `autoFocus` (unless a content element has `focus: true`). Buttons are styled via `dialog-btn--primary`, `dialog-btn--secondary`, or `dialog-btn--dangerous`.

5. **Validation error display** — When `validationResult.closeDialog === false`, errors are filtered by `contentId` and passed to the relevant content component, which renders them as red text below the field.

---

## Content Types (Detail)

### text_input

Standard text field. Supports single-line (`<input>`) and multi-line (`<textarea>` via `multiline: true`).

```typescript
type DialogContentObject_TextInput = {
  type: 'text_input';
  id: string;
  label?: string;
  value?: string | ((dialogContent, currentValue?) => string | undefined);
  defaultSelection?: { startIndex: number; endIndex: number };
  placeholder?: string;
  readonly?: boolean;
  focus?: boolean;
  multiline?: boolean;
  masked?: boolean;
  optional?: boolean;
  hint?: string;
  validationErrors?: DialogValidationError[];
};
```

The `value` field can be a function for dynamic defaults that recompute when other content objects change (e.g. auto-generating a name from a select value). When `masked: true` and `multiline` is not set, the input renders as `<input type="password">` to hide sensitive values like tokens or passwords.

### path_list

A list of file or directory paths with add/remove controls. Uses the native OS picker.

```typescript
type DialogContentObject_PathList = {
  type: 'path_list';
  id: string;
  label?: string;
  mode: 'file' | 'directory';
  initialValue?: string[];
  hint?: string;
  validationErrors?: DialogValidationError[];
};
```

Internal behavior:
- Maintains a local `useState<string[]>` for the path list, initialized with `initialValue` if provided
- "Add" button invokes `std.internal.pickNativeDirectory` (or `std.internal.pickNativeFile`) via `bifrost.commands.executeCommand`
- Duplicate paths are silently rejected
- Individual paths can be removed via the "x" button
- A hidden `<input>` serializes the array as JSON for `formToPojo`
- `initialValue` enables pre-populating the list (e.g. from drag-and-drop folders passed to the Solution Wizard)

### path_picker

A single file or directory picker. Unlike `path_list`, it selects exactly one path and stores it as a plain string in `formData` (no JSON serialization).

```typescript
type DialogContentObject_PathPicker = {
  type: 'path_picker';
  id: string;
  label?: string;
  mode: 'file' | 'directory';
  placeholder?: string;
  initialValue?: string;
  hint?: string;
  validationErrors?: DialogValidationError[];
};
```

Internal behavior:
- Renders a clickable container with the selected path (or a placeholder) and a "Browse..." button
- Clicking anywhere on the container invokes `std.internal.pickNativeDirectory` (or `std.internal.pickNativeFile`)
- Picking a new path replaces the current selection — there is no "clear" or "remove" control
- A hidden `<input>` stores the selected path as a plain string for `formToPojo`
- `formData[id]` is an empty string when nothing is selected, a plain path string otherwise

### key_value_builder

A dynamic list of key-value pairs with add/remove controls. Designed for flat map construction (e.g. payload, context variables, configuration entries).

```typescript
type DialogContentObject_KeyValueBuilder = {
  type: 'key_value_builder';
  id: string;
  label?: string;
  keyLabel?: string;
  valueLabel?: string;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  initialEntries?: readonly { key: string; value: string }[];
  hint?: string;
  optional?: boolean;
  validationErrors?: DialogValidationError[];
};
```

Internal behavior:
- Maintains a local `useState<{ key: string; value: string }[]>` for the entry list, initialized from `initialEntries ?? []`
- Each row renders a key input (~40% width), a colon separator, a value input (~50% width), and a trash icon for removal
- An "Add entry" button appends a new empty row
- A hidden `<input>` serializes the entry array as JSON for `formToPojo`
- Both keys and values are strings in `formData`; the consuming command handles type coercion (e.g. smart parsing of booleans, numbers, null)
- Validation errors render below the builder, matching the standard `.text-input__validation-error` pattern

### select

Dropdown with predefined entries.

```typescript
type DialogContentObject_Select = {
  type: 'select';
  id: string;
  label?: string;
  value?: string;
  entries: { label: string; value: any }[];
  hint?: string;
  validationErrors?: DialogValidationError[];
};
```

Select changes trigger `onSelectChange` up to `DialogContent`, which updates the content array. This enables dynamic content: other content objects with function-typed `value` fields recompute when a select changes.

### checkbox

Boolean toggle rendered via the SDK's `<Checkbox>` component.

```typescript
type DialogContentObject_Checkbox = {
  type: 'checkbox';
  id: string;
  label?: string;
  checked?: boolean;
};
```

### json / diff

Multi-line code editors powered by Monaco.

```typescript
type DialogContentObject_Json = {
  type: 'json';
  id: string;
  label?: string;
  language?: string;        // defaults to 'json'
  value?: string | ((dialogContent, currentValue?) => string | undefined);
  focus?: boolean;
  optional?: boolean;
  readOnly?: boolean;
  hint?: string;
  size?: 'small' | 'medium' | 'tall';
  validationErrors?: DialogValidationError[];
};
```

The `diff` type is similar but has `beforeValue` and `afterValue` instead of `value`.

### response_link

A clickable card that triggers a dialog response directly (bypassing the action buttons).

```typescript
type DialogContentObject_ResponseLink = {
  type: 'response_link';
  label: string;
  sublabel?: string;
  icon?: string;
  response: string;
};
```

Clicking the card calls `responseCallback(response)`, which is handled identically to clicking an action button.

### markdown / text / section / divider

Display-only content types with no form integration.

| Type | Renders As |
|------|-----------|
| `markdown` | `marked()` → `dangerouslySetInnerHTML` |
| `text` | `<p>{text}</p>` |
| `section` | Section header with bottom border |
| `divider` | Horizontal rule (`<div className="modal__divider">`) |

---

## Validation

The optional second parameter to `open()` is a `DialogValidationCallbackFn`:

```typescript
type DialogValidationCallbackFn = (dialogResult: DialogResult) => Promise<DialogValidationResult>;
```

The validation callback receives the full `DialogResult` (including `response` and `formData`) and returns one of:

- `{ closeDialog: true }` — Validation passed, dialog closes, `open()` resolves
- `{ closeDialog: false, validationErrors: [...] }` — Validation failed, dialog stays open

On failure, `DialogManager` emits `EVENT_VALIDATED_DIALOG`. The `Workbench` updates the dialog state with the validation result. `DialogRenderer` filters errors by `contentId` and passes them to the corresponding content component, which renders them as `.text-input__validation-error` elements.

```typescript
type DialogValidationError = {
  contentId: string;   // must match a content object's `id`
  errorLabel: string;  // displayed below the field
};
```

---

## Internal Picker Commands

Registered in `studio/src/bifrost/electron-renderer/entrypoint-electron-renderer.tsx`. These are thin wrappers around IPC/Electron API calls:

| Command | Mechanism | Returns |
|---------|-----------|---------|
| `std.internal.pickNativeDirectory` | IPC: `IPC_MESSAGE_SHOW_NATIVE_OPEN_DIRECTORY_DIALOG` | `string \| null` |
| `std.internal.pickNativeFile` | IPC: `IPC_MESSAGE_SHOW_NATIVE_OPEN_FILE_DIALOG` | `string \| null` |
| `std.internal.getPathsFromFiles` | `webUtils.getPathForFile()` (Electron renderer API) | `string[]` |

These commands are Electron-only. Callers check `bifrost.commands.isRegistered()` before invoking, ensuring graceful degradation in non-Electron environments. `getPathsFromFiles` is used by external drag-and-drop handlers to extract local filesystem paths from browser `File` objects.

---

## Native Dialog Handling (Main Process)

**Path:** `studio/src/bifrost/electron-main/entrypoint-electron-main.ts`

The `registerDialogHandlers()` function sets up `ipcMain.handle` listeners:

| IPC Event | Electron API | Returns |
|-----------|-------------|---------|
| `IPC_MESSAGE_SHOW_NATIVE_OPEN_FILE_DIALOG` | `dialog.showOpenDialogSync(browserWindow, withHomeFallback({ properties: ['openFile', 'multiSelections'], ...options }))` | `string[] \| null` |
| `IPC_MESSAGE_SHOW_NATIVE_OPEN_DIRECTORY_DIALOG` | `dialog.showOpenDialogSync(browserWindow, withHomeFallback({ properties: ['openDirectory'], ...options }))` | `string[] \| null` |
| `IPC_MESSAGE_SHOW_NATIVE_SAVE_FILE_DIALOG` | `dialog.showSaveDialogSync(browserWindow, withHomeFallback(options))` | `string \| null` |
| `IPC_MESSAGE_SHOW_NATIVE_MESSAGE_BOX` | `dialog.showMessageBoxSync(browserWindow, options)` | Button index → `DialogResult` |

All three file/directory handlers accept caller `options` (including `defaultPath`) and pass them through `withHomeFallback()` — the last step of the [default path tracking](#default-path-tracking) chain. `withHomeFallback()` anchors an empty or relative `defaultPath` to `app.getPath('home')`, so a dialog never falls back to Electron v43's Downloads default.

---

## Default Path Tracking

**Path:** `studio/src/bifrost/common/DialogManager.ts`

Electron v43 dropped the built-in "remember last directory" behavior for native dialogs — without an explicit `defaultPath`, every dialog opens in Downloads. `DialogManager` restores sensible behavior by resolving a `defaultPath` before each native dialog and recording the used directory afterwards. The logic lives entirely inside `DialogManager` (no separate service).

### Path Context

`DialogManager` needs two collaborators, injected once from the `Bifrost` constructor via `setPathContext()` (after the settings and solution mediators exist):

```typescript
export type DialogPathContext = {
  settings: Pick<SettingsMediator, 'has' | 'get' | 'set'>;
  getSolutionRoot: () => string | null;
};
```

The base browser `DialogService` never sets a context; when it is absent, resolution and recording degrade to a passthrough (the caller's `defaultPath` is used unchanged).

### Resolution Chain

`resolveDefaultPath(dialogType, explicitDefault?)` picks the first applicable source:

| Priority | Source | Notes |
|----------|--------|-------|
| 1 | Explicit **absolute** `defaultPath` | Used as-is |
| 2 | Explicit **relative** `defaultPath` (bare filename) | Joined onto the resolved base directory (steps 3-5); if none resolves, passed through as the filename |
| 3 | Last-used directory for the dialog family | Hidden setting `dialog.internal.lastDirectory.<type>` |
| 4 | User setting `dialog.defaultDirectory` | Manual fallback, when non-empty |
| 5 | Solution root | `getSolutionRoot()` → first project `baseUri` |
| 6 | OS home directory | Applied in the **main process** (`withHomeFallback`), not the renderer |

Steps 1-5 run in the renderer (`DialogManager`). Step 6 runs in the main process so the renderer stays free of Node `os`/`path` imports. Path string manipulation in `DialogManager` uses pure, separator-inferring helpers (`dirnameOf`, `joinPath`, `isAbsolutePath`) rather than Node's `path`.

### Recording

`recordUsedPath(dialogType, selectedPath)` runs after a non-cancelled dialog and stores `dirnameOf(selectedPath)` into the matching hidden setting. Because `dirnameOf` strips trailing separators before taking the parent segment, a directory pick records the **parent** of the chosen folder (so the dialog reopens showing that folder), while a file pick records the containing folder.

### Settings

Registered in the `Bifrost` constructor:

| Key | Type | Hidden | Purpose |
|-----|------|--------|---------|
| `dialog.defaultDirectory` | `string` | No | User-configurable global fallback directory (category "File Dialogs") |
| `dialog.internal.lastDirectory.openFile` | `string` | Yes | Auto-tracked last directory for open-file dialogs |
| `dialog.internal.lastDirectory.openDirectory` | `string` | Yes | Auto-tracked last directory for open-directory dialogs |
| `dialog.internal.lastDirectory.saveFile` | `string` | Yes | Auto-tracked last directory for save-file dialogs |

### Scope

All callers of `showOpenFile` / `showOpenDirectory` / `showSaveFile` (internal modules and plugins via `DialogsApi`) benefit transparently — no call-site changes. The internal `std.internal.pickNativeFile` / `pickNativeDirectory` commands bypass `DialogManager` and are **not** tracked.

---

## CSS

**Path:** `studio/src/components/dialog/extend.bootstrap.dialog.scss`

Key CSS classes:

| Class | Purpose |
|-------|---------|
| `.modal-dialog.modal-dialog-centered` | Dialog container (Bootstrap), vertically centered |
| `.modal-content`, `.modal-content__inner` | Dialog chrome with rounded corners and shadow |
| `.modal-header` | Title bar with close button (`.dialog__close-button`) |
| `.modal-body` | Content area containing the `<form>` |
| `.modal-footer` | Action buttons |
| `.dialog-btn--primary` | Default action button (blue) |
| `.dialog-btn--secondary` | Non-default, non-cancel button (grey) |
| `.dialog-btn--dangerous` | Dangerous action button (red) |
| `.text-input__label` | Bold label above form fields |
| `.text-input__hint` | Grey hint text below form fields |
| `.text-input__validation-error` | Red error text below form fields |
| `.response-link` | Clickable card with hover state |
| `.dialog-path-list` | Container for the path list control |
| `.dialog-path-list__item` | Individual path entry |
| `.dialog-path-list__add-button` | Dashed "Add folder/file..." button |
| `.dialog-path-picker` | Clickable single-path picker container |
| `.dialog-path-picker__path` | Selected path text |
| `.dialog-path-picker__placeholder` | Muted placeholder when no path selected |
| `.dialog-path-picker__browse` | "Browse..." button |
| `.dialog-markdown` | Rendered markdown container |
| `.dialog-kv-builder` | Container for the key-value builder control |
| `.dialog-kv-builder__header` | Column header row (Key / Value labels) |
| `.dialog-kv-builder__row` | Individual key-value entry row |
| `.dialog-kv-builder__input` | Text input for key or value |
| `.dialog-kv-builder__separator` | Colon separator between key and value |
| `.dialog-kv-builder__remove` | Trash icon to remove a row |
| `.dialog-kv-builder__add-button` | Dashed "+ Add entry" button |

---

## File Path Reference

| Component | Path |
|-----------|------|
| DialogTypes (all type definitions) | `studio-sdk/src/contracts/DialogTypes.ts` |
| DialogManager SDK types | `studio-sdk/types/common/DialogManager.ts` |
| DialogEvents | `studio-sdk/src/contracts/internal/DialogEvents.ts` |
| DialogManager (queue, validation, normalization) | `studio/src/bifrost/common/DialogManager.ts` |
| DialogService (base emitter) | `studio/src/bifrost/common/DialogService.ts` |
| DialogServiceElectron (native dispatch) | `studio/src/bifrost/electron-renderer/DialogServiceElectron.ts` |
| DialogContainer (modal wrapper) | `studio/src/components/dialog/Dialog.tsx` |
| DialogRenderer (content switch, form logic) | `studio/src/components/dialog/DialogRenderer.tsx` |
| Dialog CSS | `studio/src/components/dialog/extend.bootstrap.dialog.scss` |
| Workbench (event subscriber) | `studio/src/components/Workbench.tsx` |
| IPC events | `studio/src/bifrost/contracts/IpcEvents.ts` |
| Main process handlers | `studio/src/bifrost/electron-main/entrypoint-electron-main.ts` |
| Native picker commands | `studio/src/bifrost/electron-renderer/entrypoint-electron-renderer.tsx` |
