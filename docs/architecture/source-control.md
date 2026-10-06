# Source Control

---

## Overview

Source control is a core platform service, `bifrost.sourceControl`, built like `bifrost.files` and `bifrost.http`: an abstract `SourceControlService` in `bifrost/common/`, one implementation per platform, chosen by the entrypoint. The Electron build talks to git in the main process over IPC; other builds get `SourceControlServiceDefault`, which reports itself unavailable. The service is stateless; repository state, settings and all git UI live in the `git-cruiser` module ([git-cruiser.md](git-cruiser.md)). Plugins have no access (the plugin sandbox has no `bifrost`, and `git.*` commands are on the `CommandDenylist`).

---

## Layering

| Layer | Path | Knows about |
|---|---|---|
| Types | `studio/src/bifrost/contracts/SourceControlTypes.ts` | Nothing; `SourceControl*` data shapes shared by every layer |
| Abstract service | `studio/src/bifrost/common/SourceControlService.ts` | Types |
| Web build | `studio/src/bifrost/common/SourceControlServiceDefault.ts` | `isAvailable()` resolves `false`; every other method rejects with `Source control is not available in this version of the Studio.`; `onCloneProgress` returns a no-op |
| Electron renderer | `studio/src/bifrost/electron-renderer/SourceControlServiceElectron.ts` | IPC channels; composes `SourceControlRepositoryState` |
| IPC contract | `studio/src/bifrost/contracts/GitIpcChannels.ts` | Channel names and the `GitStatusPayload` wire type; used only by the two files on either side |
| Electron main | `studio/src/bifrost/electron-main/git/` | `simple-git`, git output formats |

Wiring: `BifrostOptions.sourceControlServiceConstructor` (optional; `DEFAULT_OPTIONS` uses `SourceControlServiceDefault`), constructed in the `Bifrost` constructor as `this.sourceControl`. `entrypoint-electron-renderer.tsx` passes `SourceControlServiceElectron`. The name "source control" keeps git out of the core vocabulary; only the Electron implementation says "git".

---

## Service API

Repositories are addressed by their absolute root path (`repositoryRoot`). File arguments are paths relative to that root.

| Method | Result |
|---|---|
| `isAvailable()` | `true` when git is installed |
| `findRepositoryRoot(directoryPath)` | Root of the containing repository, or `null` |
| `getRepositoryState(repositoryRoot)` | `SourceControlRepositoryState`: branch info, file statuses (with `file://` URIs and `previousPath`, the pre-rename relative path or `null`), stash flag, merge state with conflicted files |
| `stage` / `unstage` / `remove` / `revert(repositoryRoot, filePaths)` | `git add` / `reset HEAD --` / `rm` / `checkout --` |
| `commit(repositoryRoot, message)` | `SourceControlCommitResult` (`hash`, `summary`) |
| `push(repositoryRoot, { setUpstream? })` | Pushes; sets the upstream when the branch has none |
| `pull(repositoryRoot, { rebase? })` | Never rejects: `SourceControlPullResult` with `recoverable` = `merge-conflicts`, `rebase`, `stash-and-retry` or `null` |
| `fetch(repositoryRoot)` | |
| `stash(repositoryRoot, message?)`, `stashApply(repositoryRoot, index?, { restoreIndex? })`, `stashList(repositoryRoot)` | `stashApply` is `stash pop` (`--index` with `restoreIndex`) |
| `getBranches(repositoryRoot)` | `SourceControlBranchList`; remote branches as `remotes/<remote>/<name>` |
| `switchBranch`, `createBranch(repositoryRoot, branchName, checkout)` | |
| `getFileContentAtRevision(repositoryRoot, revision, relativePath)` | File content at a commit hash, branch or `HEAD` |
| `getLog(repositoryRoot, { maxCount?, file? })` | `SourceControlLogEntry[]` |
| `getHistory(repositoryRoot, { skip, maxCount, upstream, searchText? })` | `SourceControlHistoryEntry[]`: first-parent history of the checked-out branch, newest first, with ref badges, merged branch name and unpushed flag; `[]` for a repository without commits |
| `getChangedFilesBetween(repositoryRoot, fromRevision \| null, toRevision)` | `SourceControlChangedFile[]`; `null` lists everything a root commit added |
| `getMergeBase(repositoryRoot, first, second)` | Hash or `null` |
| `getConflictBlobs(repositoryRoot, relativePath)` | Stages 1/2/3 (`base`, `ours`, `theirs`), each `null` when missing |
| `mergeAbort`, `rebaseAbort`, `rebaseContinue`, `cherryPickAbort`, `cherryPickContinue` | |
| `clone(url, targetDirectory, branch?)`, `connectFolderToRemote(targetDirectory, url, branch, newBranch?)` | Report progress through `onCloneProgress` |
| `listRemoteBranches(url)` | `SourceControlRemoteBranch[]` (`git ls-remote --heads --symref`; the remote HEAD is flagged) |
| `onCloneProgress(callback)` | Returns the unsubscribe function |

---

## Electron Renderer

`SourceControlServiceElectron` is a typed IPC client. Two methods do more than forward:

- **`getRepositoryState`** runs `IPC_INVOKE_GIT_STATUS` and `IPC_INVOKE_GIT_MERGE_STATE` in parallel, builds `file://<root>/<path>` URIs, and lists a file as conflicted when either status column is `conflicted` or git reported it in `status.conflicted`.
- **`pull`** catches the error of `IPC_INVOKE_GIT_PULL` and classifies its message with the private `classifyPullError` in the same file. `error` keeps the full IPC error message, as the pull error dialog shows it.

---

## Electron Main

**Path:** `studio/src/bifrost/electron-main/git/`

| File | Purpose |
|---|---|
| `registerGitHandlers.ts` | `ipcMain.handle` for every `IPC_INVOKE_GIT_*` channel; one `simple-git` instance per call, scoped to the given `cwd`. Called from `entrypoint-electron-main.ts` |

Every value that crosses IPC into a git argument list goes through the private argument builders at the top of `registerGitHandlers.ts` (ref and number validation, `GIT_HISTORY_LOG_FORMAT` with its separators, `parseHistoryOutput`, `parseNameStatus`, ref decoration parsing, merged-branch-name extraction); they are covered by the git integration suite, not by unit tests. The history command pins `--decorate=full` (independent of the user's `log.decorate`), `--no-show-signature`, and a trailing `--` (a file named `HEAD` is not an ambiguous argument). `show` receives `<revision>:<relativePath>` as one argument, so paths with spaces need no quoting. All git output parsing happens in the main process; the renderer receives typed results.

### IPC Channels

| Channel | Purpose |
|---------|---------|
| `IPC_INVOKE_GIT_IS_AVAILABLE` | Check if `git` is installed (`git --version`) |
| `IPC_INVOKE_GIT_IS_REPO` | Check if a path is inside a git repo; returns the repository root |
| `IPC_INVOKE_GIT_STATUS` | `git status`, branch tracking and ahead/behind, stash flag; returns `GitStatusPayload` with mapped status codes |
| `IPC_INVOKE_GIT_STAGE` | `git add` files |
| `IPC_INVOKE_GIT_UNSTAGE` | `git reset HEAD` files |
| `IPC_INVOKE_GIT_COMMIT` | `git commit` with message |
| `IPC_INVOKE_GIT_PUSH` | `git push`; pushes with `--set-upstream origin <branch>` when the branch has no upstream |
| `IPC_INVOKE_GIT_PULL` | `git pull` with optional `--rebase`; throws on failure |
| `IPC_INVOKE_GIT_REVERT` | `git checkout -- <files>` |
| `IPC_INVOKE_GIT_FETCH` | `git fetch` |
| `IPC_INVOKE_GIT_STASH` | `git stash push` with optional message |
| `IPC_INVOKE_GIT_STASH_APPLY` | `git stash pop` with optional index and `{ restoreIndex }` option (`--index`) |
| `IPC_INVOKE_GIT_STASH_LIST` | `git stash list` |
| `IPC_INVOKE_GIT_BRANCH_LIST` | `git branch -a` |
| `IPC_INVOKE_GIT_BRANCH_SWITCH` | `git checkout <branch>` |
| `IPC_INVOKE_GIT_BRANCH_CREATE` | `git checkout -b` or `git branch` |
| `IPC_INVOKE_GIT_SHOW` | `git show <revision>:<path>` |
| `IPC_INVOKE_GIT_LOG` | `git log` with optional count and file filter |
| `IPC_INVOKE_GIT_HISTORY` | `git log --first-parent`, paged by `skip` / `maxCount` after the optional `searchText` filter (`--grep=<text> --fixed-strings --regexp-ignore-case`; validated: a string of at most 200 characters without NUL), plus `git rev-list <upstream>..HEAD` for unpushed commits; returns parsed entries |
| `IPC_INVOKE_GIT_DIFF_NAME_STATUS` | `git diff --name-status -M -z <from> <to>`, or `git diff-tree --root` when `from` is `null`; returns parsed files |
| `IPC_INVOKE_GIT_MERGE_BASE` | `git merge-base <a> <b>`; `null` when there is none |
| `IPC_INVOKE_GIT_MERGE_STATE` | Merge, rebase or cherry-pick in progress (`MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD`) |
| `IPC_INVOKE_GIT_MERGE_ABORT`, `…_REBASE_ABORT`, `…_REBASE_CONTINUE`, `…_CHERRY_PICK_ABORT`, `…_CHERRY_PICK_CONTINUE` | Abort or continue the operation in progress |
| `IPC_INVOKE_GIT_CONFLICT_BLOBS` | `git show :1:` / `:2:` / `:3:` for a conflicted file |
| `IPC_INVOKE_GIT_REMOVE` | `git rm` |
| `IPC_INVOKE_GIT_CLONE` | `git clone` with optional branch and progress streaming |
| `IPC_INVOKE_GIT_LS_REMOTE` | `git ls-remote --heads --symref` for listing remote branches |
| `IPC_INVOKE_GIT_CONNECT_TO_REMOTE` | Composite: clone to temp, move `.git` into target, reset index, restore missing files ([git-cruiser.md](git-cruiser.md) §Connect Folder to Remote) |
| `IPC_MESSAGE_GIT_CLONE_PROGRESS` | Event (main → renderer): clone progress with `{ stage, progress }` |

`GIT_TERMINAL_PROMPT=0` is set when the handlers register, and every `simple-git` instance lists it in `allowEnvironment` (simple-git 4 drops parent `GIT_*` variables that are not listed). Git then fails immediately instead of waiting for credentials on a terminal the main process does not have.
