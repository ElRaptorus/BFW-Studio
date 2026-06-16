# GUI Command Design

## Purpose

Ensures that every user-facing command is accessible through **both** the command search (power users) and visible GUI elements (all users).

## When to Use

Use this skill when:
- Registering a new command that performs a user-initiated action
- Reviewing existing commands for accessibility gaps
- Adding file, folder, or solution management features

## Core Principle

The command search (`Cmd/Ctrl+Shift+P`) targets power users who know what they're looking for. For discoverability and usability, every interactive command must **also** appear in an appropriate GUI location:

1. **Menu Bar** — The primary entry point for most users. Use the `File` menu for file/folder/solution operations, `Edit` for editing, etc.
2. **Context Menus** — Provide contextual actions where they're relevant (e.g., right-clicking a file, directory, project root, or solution).
3. **Activity Bar / Status Bar** — For persistent actions or status indicators.

## Checklist for New Commands

When creating a new command:

- [ ] Register with `commands.register(..., { visibleInSearch: true, description: '...' })` for command palette access
- [ ] Add to the relevant **menu bar** submenu (e.g., `File`, `Edit`, `View`) in `initializeMenus.ts`
- [ ] Add to all relevant **context menus** where the action makes sense
- [ ] Set appropriate `visible` conditions so the entry only shows when applicable
- [ ] Provide a clear, concise label (avoid jargon or internal identifiers)

## Placement Guidelines

| Command Scope | Menu Bar Location | Context Menu Location(s) |
|---|---|---|
| Solution management | `File` menu | `std/file-explorer/solution`, `std/file-explorer/solution-root` |
| File operations | `File` menu | `std/file-explorer/file` |
| Directory operations | `File` menu | `std/file-explorer/directory` |
| Editor actions | `Edit` or `File` menu | `std/editor/editor-tab` |
| Window management | `File` menu | N/A (menu bar only) |

## Example: Adding a Solution Command

```typescript
// 1. Register in command search (power user access)
commands.register(
  'std.solution.myNewCommand',
  async () => { /* implementation */ },
  {
    visibleInSearch: true,
    description: 'My New Feature',
    enabledWhen: () => bifrost.solution.hasOpenSolution(),
  },
);
```

Then in `initializeMenus.ts`:

```typescript
// 2. Add to File menu
{
  type: 'command',
  label: 'My New Feature ...',
  id: 'file/my-new-feature',
  command: 'std.solution.myNewCommand',
  visible: bifrost.solution.hasOpenSolution(),
},

// 3. Add to relevant context menus
{
  type: 'command',
  label: 'My New Feature ...',
  id: 'std/file-explorer/solution/my-new-feature',
  command: 'std.solution.myNewCommand',
},
```

## Anti-Patterns

- **Command search only**: A command registered only in the command palette is invisible to most users.
- **Missing visibility guards**: Menu entries that appear when they can't be executed confuse users.
- **Inconsistent labels**: The same action should have the same or similar labels across all locations.

## Key Files

- `studio/src/modules/std/initializers/initializeMenus.ts` — All menu registrations
- `studio/src/modules/std/initializers/commands/` — Command implementations
- `docs/architecture/commands.md` — Command system architecture
