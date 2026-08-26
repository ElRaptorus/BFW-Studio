---
name: dialog-system
description: >-
  Build custom dialogs using the Studio's dialog system. Use when creating
  wizard flows, confirmation prompts, form-based input dialogs, or invoking
  native file/directory pickers.
---

# Dialog System

The Studio provides a rich, queued dialog system through `bifrost.dialog`. Dialogs are modal — only one is displayed at a time, and additional requests are queued automatically.

For architectural details (internal classes, type definitions, content type catalog), see [reference.md](reference.md).

## Opening a Dialog

### Simple confirmation

```typescript
const dialogResult = await bifrost.dialog.open({
  title: 'Unsaved changes',
  content: 'Do you want to save your changes?',
  actions: [
    { response: 'cancel', label: 'Cancel', cancel: true },
    { response: 'discard', label: "Don't Save" },
    { response: 'save', label: 'Save', default: true },
  ],
});

if (dialogResult.response === 'save') {
  await saveDocument();
}
```

When `content` is a `string`, it renders as a simple paragraph. For richer content, pass an array of `DialogContentObject` items.

### Form-based dialog

```typescript
const dialogResult = await bifrost.dialog.open({
  title: 'Rename Project',
  content: [
    { type: 'text_input', id: 'projectName', label: 'Name', value: currentName, focus: true },
    { type: 'select', id: 'color', label: 'Color', value: 'blue', entries: [
      { label: 'Blue', value: 'blue' },
      { label: 'Red', value: 'red' },
    ]},
  ],
  actions: [
    { label: 'Cancel', response: 'cancel', cancel: true },
    { label: 'OK', response: 'ok', default: true },
  ],
});

if (!dialogResult.wasCancelled) {
  const name = dialogResult.formData?.projectName;
  const color = dialogResult.formData?.color;
}
```

Form data is collected from all `<input>`, `<select>`, and `<textarea>` elements in the dialog form. Each content object with an `id` property contributes its value to `formData` under that key.

### Prompt (convenience)

```typescript
const userInput = await bifrost.dialog.prompt('Enter a name', 'placeholder text');
if (userInput != null) {
  // user confirmed
}
```

## Content Types

| Type | Purpose | Key Properties |
|------|---------|----------------|
| `text_input` | Single/multi-line text field | `id`, `label`, `value`, `placeholder`, `focus`, `multiline`, `readonly`, `hint` |
| `path_list` | List of files/directories with add/remove controls | `id`, `label`, `mode` (`'file'` or `'directory'`), `hint` |
| `select` | Dropdown menu | `id`, `label`, `value`, `entries[]` |
| `checkbox` | Boolean toggle | `id`, `label`, `checked` |
| `json` | Multi-line code editor (CodeMirror 6) | `id`, `label`, `value`, `language`, `size`, `readOnly`, `focus` |
| `diff` | Side-by-side diff editor (CodeMirror 6) | `id`, `label`, `beforeValue`, `afterValue`, `language`, `size` |
| `markdown_container` | Read-only Markdown viewer | `id`, `text`, `size` |
| `markdown` | Inline rendered Markdown | `text` |
| `text` | Plain text paragraph | `text` |
| `section` | Section header with divider | `text` |
| `divider` | Horizontal rule | *(none)* |
| `response_link` | Clickable card that triggers a response | `label`, `sublabel`, `icon`, `response` |

### `path_list` — Directory/File Picker

The `path_list` content type provides a list control with an "Add folder..." (or "Add file...") button that invokes the native OS file picker. Paths can be removed individually. The value is serialized as a JSON array string in `formData`.

```typescript
content: [
  {
    type: 'path_list',
    id: 'directories',
    label: 'Directories to include',
    mode: 'directory',
    hint: 'You can always add more later.',
  },
],
```

In the consumer, parse the JSON:

```typescript
const rawPaths: string = dialogResult.formData?.directories ?? '[]';
const paths: string[] = JSON.parse(rawPaths);
```

The native picker is invoked via internal commands (`std.internal.pickNativeDirectory` / `std.internal.pickNativeFile`), which are only available in the Electron renderer. The component gracefully degrades (button does nothing) when these commands are not registered.

## Validation

Pass a validation callback as the second argument to `open()`. Return `{ closeDialog: false, validationErrors: [...] }` to keep the dialog open with error messages, or `{ closeDialog: true }` to allow closing.

```typescript
const validation = async (dialogResult: DialogResult): Promise<DialogValidationResult> => {
  if (dialogResult.response === 'ok') {
    const name = dialogResult.formData?.projectName?.trim();
    if (!name) {
      return {
        closeDialog: false,
        validationErrors: [{ contentId: 'projectName', errorLabel: 'Name cannot be empty' }],
      };
    }
  }
  return { closeDialog: true };
};

const result = await bifrost.dialog.open(dialogOptions, validation);
```

Validation errors are displayed below the corresponding content element (matched by `contentId` → content `id`).

## Native File Dialogs

These bypass the custom dialog renderer and use the OS-native file picker (Electron only):

```typescript
const filePaths: string[] | null = await bifrost.dialog.showOpenFile({
  title: 'Select File',
  filters: [{ name: 'BPMN', extensions: ['bpmn'] }],
});

const directoryPaths: string[] | null = await bifrost.dialog.showOpenDirectory();

const savePath: string | null = await bifrost.dialog.showSaveFile({
  title: 'Save Solution as...',
  defaultPath: '/home/user/my-project.essln',
  filters: [{ name: 'Bifrost Forge World Solution', extensions: ['essln'] }],
});
```

## Actions

Each action in the `actions` array maps to a button in the dialog footer:

| Property | Effect |
|----------|--------|
| `response` | String returned as `dialogResult.response` |
| `label` | Button text |
| `default` | Triggers on Enter; receives primary styling |
| `cancel` | Sets `dialogResult.wasCancelled = true` |
| `dangerous` | Receives red/danger styling |

## Dialog Options

| Property | Purpose |
|----------|---------|
| `title` | Dialog header text |
| `content` | `string` or `DialogContentObject[]` |
| `actions` | Array of action buttons |
| `className` | Additional CSS class on the dialog container |
| `hideCloseButton` | Hides the X button in the top-right corner |

## Wizard Pattern

For multi-step workflows (like "Create Solution"), chain a custom dialog with a native dialog:

```typescript
const wizardResult = await bifrost.dialog.open(wizardOptions, wizardValidation);
if (wizardResult.wasCancelled) return;

const savePath = await bifrost.dialog.showSaveFile({ ... });
if (savePath == null) return;

// proceed with the collected data
```

The custom dialog fully closes before `showSaveFile` is called, so there is no queue conflict.

## Dialogs vs Notifications

Dialogs are **modal and queued** — they block the UI until dismissed. Use them only when the user **must** make a decision before continuing:

- **Confirmation before a destructive action** (delete, revert, overwrite)
- **Recovery choices** after a failure (e.g. "Stash & Retry" vs "Close")
- **Form input** that the user must provide (commit message, branch name)
- **Wizard flows** with multi-step user input

**Never** use `bifrost.dialog.open` to display informational error messages. Use `bifrost.notifications.open` instead:

```typescript
// WRONG — blocks UI for a non-actionable error
await bifrost.dialog.open({
  title: 'Git Push Failed',
  content: error?.message ?? String(error),
  actions: [{ label: 'Close', response: 'close', default: true }],
});

// CORRECT — non-blocking notification
bifrost.notifications.open({
  type: 'error',
  content: `Push failed: ${error?.message ?? String(error)}`,
  source: 'My Module',
});
```

A dialog whose only action is a single "Close" / "OK" button with no side effects is almost certainly a notification in disguise.

### Exception: Content viewer dialogs

A dialog is appropriate even without a blocking decision when **all three** conditions are met:

1. **User-initiated** — the user explicitly requested the information (e.g. "Show Change Summary")
2. **Rich or large content** — the result is too long or structured for a notification toast (multi-line markdown, tables, diffs)
3. **Actionable** — the dialog offers at least one meaningful action beyond "Close" (e.g. "Copy to Clipboard")

In these cases, use a `markdown_container` content type for proper rendering, and include an action that justifies the modal:

```typescript
const result = await bifrost.dialog.open({
  title: 'Git: Change Summary',
  content: [{ type: 'markdown_container', id: 'summary', text: summaryMarkdown, size: 'medium' }],
  actions: [
    { label: 'Copy to Clipboard', response: 'copy' },
    { label: 'Close', response: 'close', default: true, cancel: true },
  ],
});

if (result?.response === 'copy') {
  await navigator.clipboard.writeText(summaryMarkdown);
}
```

If you cannot add a meaningful action, the content is probably better suited for the notification panel or a dedicated pane.

### Notifications for optional or trivial user input

When user input is needed for an action that is **not required** for the main feature to function, prefer a notification over a dialog. Dialogs block the UI; notifications let the user respond at their own pace.

**Decision rule**: Ask — "Can the feature work without this input?" If yes, use a notification.

**Example — setting up a .gitignore when cloning a repository**:

The user **must** provide the Git repository URL → **dialog** (blocking input required).
The user **can** consent to create a `.gitignore` file → **notification** (optional convenience action).

```typescript
// WRONG — blocks UI for an optional, non-essential action
await bifrost.dialog.open({
  title: 'Optional: Setup .gitignore',
  content: `The repository ${repoName} has no .gitignore file. Create one?`,
  actions: [
    { label: 'No', response: 'no' },
    { label: 'Yes', response: 'yes', default: true },
  ],
});

// CORRECT — non-blocking notification with action callback
const notificationId = bifrost.notifications.open(
  {
    type: 'info',
    content: `Repository "${repoName}" has no .gitignore file. Create one with recommended patterns?`,
    source: 'My Module',
    actions: [
      { action: 'dontAskAgain', label: `Don't ask again` },
      { action: 'dismiss', label: 'No' },
      { action: 'create', label: 'Create', default: true },
    ],
  },
  (response) => {
    // Unlike Dialogs, notifications must be closed explicitly.
    bifrost.notifications.close(notificationId);

    if (response.action === 'dontAskAgain') {
      bifrost.settings.set('myModule.suggest.gitignore', false);
    } else if (response.action === 'create') {
      // create the file
    }
  },
);
```

Note that `bifrost.notifications.open` is fire-and-forget — the second argument is a callback, not an awaitable. Handle all follow-up work (file creation, setting updates) inside the callback.

## Startup Timing

The dialog renderer is only available **after the Studio has fully initialized**. If module code runs during `onLoad` (before the UI is mounted), any `bifrost.dialog.open` call will queue a dialog that cannot be displayed — effectively freezing the dialog queue and blocking all future dialogs.

**Rule**: If a module needs to show a dialog at startup (e.g. a suggestion prompt), it **must** defer the call until the `ready` event:

```typescript
bifrost.events.on('ready', () => {
  bifrost.commands.executeCommand('myModule.suggestSomething');
});
```

This applies to any code path reachable from `onLoad` or `onActivate` that could open a dialog.

## Key Files

| File | Purpose |
|------|---------|
| `studio/src/bifrost/contracts/DialogTypes.ts` | All dialog type definitions |
| `studio/src/bifrost/common/DialogManager.ts` | `bifrost.dialog` implementation |
| `studio/src/components/dialog/DialogRenderer.tsx` | React renderer for custom dialogs |
| `studio/src/components/dialog/extend.bootstrap.dialog.scss` | Dialog styles |
| `studio/src/bifrost/common/DialogService.ts` | Dialog queue and lifecycle management |
| `studio/src/bifrost/electron-renderer/entrypoint-electron-renderer.tsx` | Native picker command registration |
