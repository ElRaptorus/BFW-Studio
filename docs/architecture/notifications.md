# Notification System

---

## Overview

The notification system provides non-modal feedback for informational messages, warnings, and errors. Unlike dialogs, notifications do not block user interaction — they appear in a collapsible panel and persist until explicitly dismissed.

Notifications are managed by `NotificationManager`, surfaced on `bifrost.notifications`, and rendered by `Workbench` when the notification panel is maximized.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Module / app code                                               │
│    bifrost.notifications.open(options, responseCallback?)             │
│    bifrost.notifications.update(id, options)                         │
│    bifrost.notifications.close(...ids)                               │
│    bifrost.notifications.toggle()                                    │
├─────────────────────────────────────────────────────────────────────┤
│  NotificationManager                                                │
│    ├─ notifications[]                                               │
│    ├─ maximized (panel visibility)                                  │
│    ├─ normalizeNotificationOptions() (static)                       │
│    ├─ emit EVENT_OPEN_NOTIFICATION                                  │
│    └─ emit EVENT_CLOSE_NOTIFICATION                                 │
├─────────────────────────────────────────────────────────────────────┤
│  Workbench (React)                                                  │
│    subscribes to open/close events                                  │
│    renders NotificationContainer when maximized                     │
│      └─ NotificationRenderer (per notification)                     │
├─────────────────────────────────────────────────────────────────────┤
│  StatusBarMediator                                                  │
│    refreshes status bar bell + count on open/close                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## NotificationManager

**Path:** `studio/src/bifrost/common/NotificationManager.ts`
**Exposed as:** `bifrost.notifications`

### Internal State

| Field | Type | Purpose |
|-------|------|---------|
| `notifications` | `Notification[]` | All notifications (visible and hidden) |
| `maximized` | `boolean` | Whether the notification panel is expanded |

### Public API

| Method | Returns | Description |
|--------|---------|-------------|
| `open(options \| string, responseCallback?)` | `string` | Creates a notification and returns its id. Opens the panel. |
| `close(...notificationIds)` | `void` | Marks notifications as not visible. Collapses panel if none remain visible. |
| `toggle()` | `void` | Flips the `maximized` flag. Used by the status bar bell icon. |
| `update(id, options \| string)` | `void` | Replaces the options of an existing notification by id. |

### Internal-only methods (not on the public `bifrost.notifications` API)

| Method | Returns | Description |
|--------|---------|-------------|
| `getViewData()` | `NotificationsViewData` | Returns `{ maximized, notifications }` for React state. |
| `getVisibleNotifications()` | `Notification[]` | Filtered list where `visible === true`, sorted non-sticky first. |
| `getAllNotifications()` | `Notification[]` | Full list including closed/hidden entries. |

---

## Types

**Host types** (`studio/src/bifrost/contracts/NotificationTypes.ts`):

```typescript
type NotificationType = 'info' | 'warning' | 'error';

type NotificationOptions = {
  readonly type?: NotificationType;       // default: 'info'
  readonly content: NotificationContent;  // string
  readonly source?: string;               // origin label, default: 'unknown'
  readonly actions?: NotificationAction[];
  readonly sticky?: boolean;              // affects sort order only
};

type NotificationActionObject = {
  readonly action: string;    // response identifier
  readonly label: string;     // button text
  readonly default?: boolean; // primary styling
  readonly cancel?: boolean;  // cancel semantics
};
```

**Internal types** (`studio/src/bifrost/contracts/NotificationTypes.ts`):

```typescript
type Notification = {
  id: string;
  options: NotificationOptionsStrict;
  responseCallbackFn: (action: NotificationAction) => void;
  createdAt: Date;
  visible: boolean;
};

type NotificationsViewData = {
  maximized: boolean;
  notifications: Notification[];
};
```

---

## Lifecycle

### Opening

1. `bifrost.notifications.open(options, callback?)` normalizes the options (fills defaults), creates a `Notification` with `visible: true`, appends it to the internal list.
2. Sets `maximized = true`.
3. Emits `EVENT_OPEN_NOTIFICATION`.
4. `Workbench` receives the event, copies `getViewData()` into React state, and conditionally renders `NotificationContainer`.

### Closing

1. `close(...ids)` sets `visible = false` for the matching notifications.
2. Emits `EVENT_CLOSE_NOTIFICATION`.
3. If no visible notifications remain, calls `toggle()` to collapse the panel.
4. Closed notifications remain in `getAllNotifications()` (used by the Notification Inspector for history).

### Toggling

`toggle()` flips `maximized` and emits `EVENT_OPEN_NOTIFICATION`. The status bar bell and the command `std.workbench.toggleNotifications` use this to show/hide the panel without removing notifications.

### Updating

`update(id, options)` replaces the `options` field of an existing notification (by id) and emits `EVENT_OPEN_NOTIFICATION` to trigger a re-render.

---

## Dismissal Behavior

There is **no automatic dismissal** or timeout mechanism. Notifications persist until:

- The user clicks the per-notification close button (X).
- The user clicks "Close all" in the notification container header.
- Code calls `bifrost.notifications.close(id)`.

The `sticky` flag only affects sort order in `getVisibleNotifications()` (non-sticky notifications appear before sticky ones). It does **not** prevent dismissal.

---

## Rendering

### NotificationContainer

**Path:** `studio/src/components/notifications/NotificationContainer.tsx`

Renders the list of visible notifications. Shows a "Close all" button in the header when multiple notifications are present. Sets the `data--test--unexpected-notifications` attribute when any visible notification is `warning` or `error` (used by `StudioAgent` in tests).

### NotificationRenderer

**Path:** `studio/src/components/notifications/NotificationRenderer.tsx`

Renders a single notification with:

- **Type icon** — Phosphor icon based on `type` (`info`, `warning`, `error`).
- **Content** — The notification message text.
- **Source** — Footer label showing the origin (`source` field).
- **Actions** — Footer buttons. `default: true` gets primary styling, others get secondary styling.
- **Close button** — Triggers the response callback with `'close'`.

### Action Handling

When an action button is clicked, the `responseCallbackFn` receives the full action object. Handlers typically check `response.action` to determine the user's choice.

The close (X) button passes the string `'close'` (not an action object) to the callback.

---

## Styling

| File | Scope |
|------|-------|
| `studio/src/components/notifications/workbench.notification.scss` | Layout, structure, type-specific icon colors (blue for info, orange for warning, red for error) |
| `studio/src/bifrost/styles/theme.light.scss` / `theme.dark.scss` | `--theme-notification-*` CSS custom properties for backgrounds, headers, and button colors |
| `studio/src/bifrost/styles/bifrost.scss` | Notification container and button theme token wiring inside `.bifrost` |

---

## Status Bar Integration

**Path:** `studio/src/modules/std/initializers/initializeStatusBarItems.ts`

The status bar shows a bell icon with the count of visible notifications. Clicking it calls `std.workbench.toggleNotifications`.

**Path:** `studio/src/bifrost/browser/StatusBarMediator.ts`

Listens for `EVENT_OPEN_NOTIFICATION` and `EVENT_CLOSE_NOTIFICATION` to refresh the status bar item count.

---

## When to Show Notifications

Success notifications should be used **sparingly**. The guiding principle: only notify when the completed action has **no immediate visual feedback** in the UI.

| Show notification | Skip notification |
|---|---|
| `git push` — no visible UI change | `git commit` — file explorer badges update, Git Pane clears staged files |
| `git pull` — remote changes are not visible until refresh | `git stash` — file explorer decorations and Git Pane update instantly |
| `git sync` — combined remote operation | `git stash apply` — changes reappear in the UI immediately |
| | `switch branch` — status bar updates, file explorer decorations change |
| | `create branch` — status bar shows new branch name |
| | Stage / unstage — file moves between sections in the Git Pane |
| | Revert — file decorations disappear, editor content reverts |

**Errors and warnings** should always produce a notification (or dialog), because the user needs to know something went wrong regardless of UI state.

**Rule of thumb**: If the user can see the result of their action by looking at the UI they're already interacting with, a success notification is visual noise that interrupts their workflow without adding information.

---

## Common Usage Patterns

### Simple info notification

```typescript
bifrost.notifications.open({
  type: 'info',
  content: 'Operation completed successfully.',
});
```

### Shorthand (string-only)

```typescript
bifrost.notifications.open('Something happened.');
```

### Error with action

```typescript
bifrost.notifications.open(
  {
    type: 'error',
    content: 'Failed to save file.',
    source: 'File System',
    actions: [
      { action: 'retry', label: 'Retry', default: true },
      { action: 'dismiss', label: 'Dismiss', cancel: true },
    ],
  },
  (response) => {
    if (response.action === 'retry') {
      // retry logic
    }
  },
);
```

### Update and close

```typescript
const id = bifrost.notifications.open({ type: 'info', content: 'Downloading...' });
// later:
bifrost.notifications.update(id, { type: 'info', content: 'Download complete.' });
// later:
bifrost.notifications.close(id);
```

---

## Testing

- **`StudioAgent.assertNoErrorOrWarningNotificationsVisible`** — Checks for the `data--test--unexpected-notifications` attribute on the notification container. If present, the test fails, indicating an unexpected warning or error notification appeared during the test run.
- **Machine Sanctum** — `NotificationExamples.tsx` and `NotificationExampleRenderer.tsx` provide interactive previews for testing notification payloads.
