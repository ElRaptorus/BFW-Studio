# Solution Management — Reference

For detailed architecture documentation on Solutions, Projects, file handling, the file explorer, search/symbol indexing, session restore, and window management, see:

**[docs/architecture/workspace.md](../../../docs/architecture/workspace.md)**

Key file paths:

| Component | Path |
|-----------|------|
| Solution/Project types | `studio/src/bifrost/contracts/SolutionTypes.ts` |
| SolutionManager (+ .bfwsln I/O) | `studio/src/bifrost/common/SolutionManager.ts` |
| SolutionMediator | `studio/src/bifrost/common/SolutionMediator.ts` |
| FileExplorerView | `studio/src/bifrost/common/activities/FileExplorerView.ts` |
| SolutionPane (UI) | `studio/src/components/panes/activities/files/SolutionPane.tsx` |
| Solution commands | `studio/src/modules/std/initializers/commands/initializeSolutionCommands.ts` |
| Solution file commands | `studio/src/modules/std/initializers/commands/initializeSolutionFileCommands.ts` |
| Create Solution command | `studio/src/modules/std/initializers/commands/initializeCreateSolutionCommand.ts` |
| Menu registration | `studio/src/modules/std/initializers/initializeMenus.ts` |
