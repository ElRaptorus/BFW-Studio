# Dialog System — Architectural Reference

For the full architectural documentation of the dialog system (internal classes, queue lifecycle, rendering pipeline, content types, validation flow, native dialog handling), see:

**[docs/architecture/dialogs.md](../../docs/architecture/dialogs.md)**

## Type Definitions

All dialog types are defined in `studio-sdk/src/contracts/DialogTypes.ts` and exported via `@evil/bifrost_fw_sdk`.

### DialogOptions

The entry type for `bifrost.dialog.open()`. Can be one of:

- `DialogOptions_Custom` — Rich form dialog with title, content objects, and actions
- `DialogOptions_MessageBox` — Simple message box with content and actions
- `DialogOptionsStrict_OpenFile` — Native file picker (via `showOpenFile`)
- `DialogOptionsStrict_OpenDirectory` — Native directory picker (via `showOpenDirectory`)
- `DialogOptionsStrict_SaveFile` — Native save dialog (via `showSaveFile`)

### DialogContentObject (union)

All 12 content types for rich dialog forms:

| Type Key | TypeScript Type | Has `id` | Produces `formData` |
|----------|----------------|----------|---------------------|
| `text_input` | `DialogContentObject_TextInput` | Yes | String value |
| `path_list` | `DialogContentObject_PathList` | Yes | JSON-encoded string array |
| `select` | `DialogContentObject_Select` | Yes | Selected value |
| `checkbox` | `DialogContentObject_Checkbox` | Yes | Boolean (checked state) |
| `json` | `DialogContentObject_Json` | Yes | String (editor content) |
| `diff` | `DialogContentObject_Diff` | Yes | *(read-only, no form data)* |
| `markdown_container` | `DialogContentObject_MarkdownEditor` | Yes | *(read-only)* |
| `markdown` | `DialogContentObject_Markdown` | No | — |
| `text` | `DialogContentObject_Text` | No | — |
| `section` | `DialogContentObject_Section` | No | — |
| `divider` | `DialogContentObject_Divider` | No | — |
| `response_link` | `DialogContentObject_ResponseLink` | No | — (triggers response directly) |

### DialogResult

```typescript
type DialogResult = {
  readonly wasCancelled: boolean;
  readonly response?: string;
  readonly formData?: { [contentId: string]: any };
};
```

### DialogValidationResult

```typescript
type DialogValidationResult =
  | { closeDialog: true }
  | { closeDialog: false; validationErrors: DialogValidationError[] };

type DialogValidationError = {
  contentId: string;   // matches the content object's `id`
  errorLabel: string;  // displayed below the field
};
```

## Form Data Collection

`DialogRenderer` uses a `formToPojo` function that queries all `<input>`, `<select>`, and `<textarea>` elements in the dialog's `<form>` node. For each element with a `name` attribute:

- Checkboxes: `element.checked` (boolean)
- Everything else: `element.value` (string)

Code editors (`json`, `diff`) contribute their values via `codeEditorRef.current.getCurrentValue()`.

The `path_list` control uses a hidden `<input type="hidden" name={id} value={JSON.stringify(paths)}>` to participate in form serialization.

## Internal Picker Commands

Registered in `studio/src/bifrost/electron-renderer/entrypoint-electron-renderer.tsx`:

| Command | IPC Event | Returns |
|---------|-----------|---------|
| `std.internal.pickNativeDirectory` | `IPC_MESSAGE_SHOW_NATIVE_OPEN_DIRECTORY_DIALOG` | `string \| null` |
| `std.internal.pickNativeFile` | `IPC_MESSAGE_SHOW_NATIVE_OPEN_FILE_DIALOG` | `string \| null` |

These are Electron-only. The `path_list` component checks `bifrost.commands.isRegistered()` before invoking.

## Key Files

| File | Purpose |
|------|---------|
| `studio-sdk/src/contracts/DialogTypes.ts` | Type definitions for all dialog content, options, actions, results |
| `studio-sdk/types/common/DialogManager.ts` | SDK type declaration for `bifrost.dialog` |
| `studio/src/bifrost/common/DialogService.ts` | Dialog queue, open/close lifecycle |
| `studio/src/bifrost/common/DialogManager.ts` | Business logic layer around DialogService |
| `studio/src/components/dialog/DialogRenderer.tsx` | React component: renders all content types |
| `studio/src/components/dialog/Dialog.tsx` | Dialog wrapper (backdrop, positioning) |
| `studio/src/components/dialog/extend.bootstrap.dialog.scss` | All dialog CSS |
| `studio/src/bifrost/electron-renderer/entrypoint-electron-renderer.tsx` | Native picker commands |
| `studio/src/bifrost/contracts/IpcEvents.ts` | IPC event constants |
