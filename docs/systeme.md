# Studio Subsystems

## Commands

Commands change the state of the world as a result of an interaction.

Each command has a unique identifier, a title, a callback that carries out its business logic, and an optional predicate callback that returns whether the command is currently executable (e.g. to grey out the "Save" icon in the toolbar when the document is unchanged and does not need saving).

To close the currently focused document, for example, the command `editor.closeFocusedDocument` can be executed instead of calling a TypeScript function directly:

```typescript
bifrost.commands.executeCommand('editor.closeFocusedDocument');
```

This separates user intent from execution, ensures the command callback's context, and channels any runtime errors that occur during execution into controlled paths.

Commands are explicit and semantic.

By using commands it can be guaranteed that clicking the "Save" icon in the toolbar invokes the same code *under the same conditions* as clicking "File → Save" in the menu or pressing Ctrl+S on the keyboard.

The same applies to greying out the Save icon in the toolbar or the "File → Save" menu entry: commands ensure a uniform appearance and interface.

[More concrete information in the source](../studio/src/bifrost/browser/CommandMediator.ts)

## Input Systems

The primary input system is the keybindings system, which manages keyboard shortcuts:

Keyboard shortcuts are stored in a human-readable notation, e.g. "Ctrl+Shift+F", and bind a key combination to a command.

Keyboard shortcuts are combinable, both simultaneously ("Shift+K") and sequentially ("Shift+K T").

Keyboard shortcuts can be differentiated by client type (Web, Desktop) and operating system (Windows, Mac, Linux).

[More concrete information in the source](../studio/src/bifrost/browser/KeybindingsMediator.ts)

## Error Handling

A design goal of the Studio was that the end user notices all unhandled runtime errors and is informed about them in a way that can be acted upon later.

## Notifications

Notifications are messages that support asynchronous, parallel workflows.
For example, when an "An update for Studio is available" notification appears, it is not critical that the user interacts with it immediately.

For displaying results or events arising from a user interaction with a UI element, the relevant UI element itself should be responsible. For instance, an unsuccessful search should show a "No results" message within the search UI — and *not* use a notification.

Notifications are best used when events occur asynchronously from the user's perspective.
The search operation described above may technically be an `async` method in JavaScript, but from the user's point of view it is a synchronous flow: type a search term → press Enter → expect results (even if that takes a second).

An example of an asynchronous operation that has no UI element currently being interacted with would be a notification about a suddenly unreachable Engine.

A notification says: "You need to take note of this at some point and possibly take action."

## Dialog System

Dialogs are interaction mechanisms that support synchronous, modal workflows.
Only one dialog can be displayed at a time.

A dialog says: "You need to pay attention to this **right now** and take action."

Dialogs can of course also be used for less dramatic modal workflows.

The crucial point is that a dialog is a modal element that blocks the entire UI so that only it receives the user's attention.

<!-- TODO: This documentation is not yet very thorough -->

[More concrete information in the source](../studio/src/bifrost/common/DialogService.ts)

## Multi-Window Management

Bifrost Forge World supports opening multiple projects in multiple windows.

The window management system ensures that, for example, changed settings such as selecting a different theme are applied to all open windows.

## Multi-Document Management

Bifrost Forge World supports opening multiple documents within a single window/instance.

"Document" in this context refers to any view opened in an editor tab, regardless of whether it originates from a file:
the welcome view is a document, a BPMN diagram is a document, and the documentation for a BPMN element edited in a separate tab is also its own document with its own URI.

Every document belongs to a "document type".

Each document type must be associated with a "document renderer" so it can be displayed.
For passive views that only visualise information, such as the welcome view, this is sufficient.
For views that contain "business logic", a "document model" can additionally be registered with the document type.

This separates presentation from business logic.

<!-- This could probably use a lot more detail, and I'm not sure where we want to document it in the code -->

## Modules and Plugins

While all the systems described in this document are part of Bifrost Forge World's core, the actual domain functionality is provided via modules (bundled) and plugins (user-installed).

*Modules* ship with Bifrost Forge World and are compiled directly into the application.
They reside under `src/modules` in the Studio repository.
Due to their proximity to the core application, slightly different rules apply to them compared to plugins, and they have access to additional capabilities (the concept of bundled modules with "bleeding edge" access is borrowed from VS Code).

Modules…

- ship directly with Bifrost Forge World
- may call internal APIs without compatibility guarantees
- may, in justified cases, share code with one another (e.g. contracts)

*Plugins* are user-installed and process-isolated. The legacy dynamic loading approach (loading scripts from `~/.evil/studio/extensions/` into the renderer process) has been removed due to fundamental isolation and stability issues. See `docs/extensions-v2/extension-v2-roadmap.md` for the roadmap toward a proper plugin mechanism with process isolation and declarative manifests.

## Icons

Icons are centrally managed by Bifrost Forge World.

Bifrost Forge World uses Phosphor Icons as its sole icon framework. It also allows registering custom icons under custom names.

```typescript
bifrost.icons.registerIcons({ 'my-plugin/highfive/button': 'ph-fill ph-star' });
```

The recommended naming convention follows the pattern `plugin-name/context/element`.

Import the host `Icon` component to render registered icons:

```typescript
import { Icon } from '#components/Icon';

function HighFiveButton(props: any) {
  return <button>
    {props.username}
    <Icon id="my-plugin/highfive/button" />
  </button>;
}
```

[More concrete information in the source](../studio/src/bifrost/common/IconMediator.ts)

## Panes

Panes are the segments in the sidebar, property panel, and inspector panel that display information such as file lists, search results, or BPMN properties.

Panes are centrally managed by Bifrost Forge World.

For each pane, an object is registered that contains content, title, etc. as well as a predicate function that decides whether the pane should be shown in the current editor context.

<!-- TODO: This documentation is not yet very thorough -->

[More concrete information in the source](../studio/src/bifrost/common/PaneMediator.ts)

## Editors

Bifrost Forge World can open multiple documents in an editor via tabs, and also display multiple editors side by side or stacked in a "Split View".

<!-- TODO: This documentation is not yet very thorough -->

[More concrete information in the source](../studio/src/bifrost/browser/EditorMediator.ts)

## Menus

Both application and context menus are centrally managed by Bifrost.

Menus are registered under a name and contain a factory function that can produce the menu as a data object:

```typescript
bifrost.menus.registerMenu('my-plugin/foo', (): Menu => {
  return [
    {
      type: 'command',
      label: 'Choose Theme',
      command: 'std.workbench.chooseTheme',
    },
    {
      type: 'command',
      label: 'Quick Jump',
      command: 'std.quickJump.showCommands',
    },
  ];
});
```

The menu can later be retrieved and displayed via Bifrost:

```typescript
bifrost.menus.getMenu('foo/bar', ['catch', 22])

<div onContextMenu={(event) => showContextMenu(event, "foo/bar", ['catch', 22])}>
  <div>Content with context menu</div>
</div>
```

[More concrete information in the source](../studio/src/bifrost/browser/MenuMediator.ts)

## Settings

Bifrost centrally manages all settings.
Setting changes are automatically propagated across all windows by Bifrost.

Every module must register the settings it uses before it can access them.
Afterwards, the user can modify those settings.

[Detailed architecture documentation](architecture/settings.md)

<!--
## Views & ViewMediators

Views & ViewMediators

QuickJump

Solution

UserLogins

Performance

RecentlyOpened
-->
