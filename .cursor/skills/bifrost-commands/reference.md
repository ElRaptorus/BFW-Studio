# Command System — Architectural Reference

For the full architectural documentation of the command system (internal classes, type definitions, method signatures, execution flow, and cross-module communication patterns), see:

**[docs/architecture/commands.md](../../docs/architecture/commands.md)**

Key topics covered there:

- **CommandManager** — internal command storage, `doRegisterCommand`, `expectsCommandContext` flag
- **CommandMediator** — full method table with signatures, execution flow, enabled predicate handling
- **Click handler** — how `getClickHandler()` wraps events into `CommandContext`
- **Type definitions** — `Command`, `CommandContext` variants, `CommandResult<T>`, `CommandEnabledPredicateFn`
- **Naming convention** — `{module}.{domain}.{action}` and the `[a-zA-Z0-9\-_.]+` constraint
- **Command listings** — Solution commands, File Explorer commands, Editor commands
- **File path reference** — all relevant source files
