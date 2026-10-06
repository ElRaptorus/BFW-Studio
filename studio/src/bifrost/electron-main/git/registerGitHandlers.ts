import type { GitStatusPayload } from '#bifrost/contracts/GitIpcChannels';
import {
  IPC_INVOKE_GIT_BRANCH_CREATE,
  IPC_INVOKE_GIT_BRANCH_LIST,
  IPC_INVOKE_GIT_BRANCH_SWITCH,
  IPC_INVOKE_GIT_CHERRY_PICK_ABORT,
  IPC_INVOKE_GIT_CHERRY_PICK_CONTINUE,
  IPC_INVOKE_GIT_CLONE,
  IPC_INVOKE_GIT_COMMIT,
  IPC_INVOKE_GIT_CONFLICT_BLOBS,
  IPC_INVOKE_GIT_CONNECT_TO_REMOTE,
  IPC_INVOKE_GIT_DIFF_NAME_STATUS,
  IPC_INVOKE_GIT_FETCH,
  IPC_INVOKE_GIT_HISTORY,
  IPC_INVOKE_GIT_IS_AVAILABLE,
  IPC_INVOKE_GIT_IS_REPO,
  IPC_INVOKE_GIT_LOG,
  IPC_INVOKE_GIT_LS_REMOTE,
  IPC_INVOKE_GIT_MERGE_ABORT,
  IPC_INVOKE_GIT_MERGE_BASE,
  IPC_INVOKE_GIT_MERGE_STATE,
  IPC_INVOKE_GIT_PULL,
  IPC_INVOKE_GIT_PUSH,
  IPC_INVOKE_GIT_REBASE_ABORT,
  IPC_INVOKE_GIT_REBASE_CONTINUE,
  IPC_INVOKE_GIT_REMOVE,
  IPC_INVOKE_GIT_REVERT,
  IPC_INVOKE_GIT_SHOW,
  IPC_INVOKE_GIT_STAGE,
  IPC_INVOKE_GIT_STASH,
  IPC_INVOKE_GIT_STASH_APPLY,
  IPC_INVOKE_GIT_STASH_LIST,
  IPC_INVOKE_GIT_STATUS,
  IPC_INVOKE_GIT_UNSTAGE,
  IPC_MESSAGE_GIT_CLONE_PROGRESS,
} from '#bifrost/contracts/GitIpcChannels';
import { MAXIMUM_HISTORY_SEARCH_LENGTH } from '#bifrost/contracts/SourceControlTypes';
import type {
  SourceControlChangedFile,
  SourceControlChangedFileStatus,
  SourceControlFileStatusCode,
  SourceControlHistoryEntry,
  SourceControlHistoryRequest,
  SourceControlRefDecoration,
} from '#bifrost/contracts/SourceControlTypes';
import { ipcMain } from 'electron';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import type { BranchSummary, LogResult, SimpleGit, SimpleGitOptions, StatusResult } from 'simple-git';
import { simpleGit } from 'simple-git';

/**
 * Format of the `git log` run for `IPC_INVOKE_GIT_HISTORY`, parsed by `parseHistoryOutput`.
 * Fields: hash, parent hashes (space separated), author name, author date (strict ISO 8601), full ref decorations (`--decorate=full`), subject.
 */
const GIT_HISTORY_FIELD_SEPARATOR = '\x1f';
const GIT_HISTORY_RECORD_SEPARATOR = '\x1e';
const GIT_HISTORY_LOG_FORMAT = '%H%x1f%P%x1f%an%x1f%aI%x1f%D%x1f%s%x1e';

const SAFE_GIT_REF_PATTERN = /^[^-\s][^\s]*$/;

/**
 * A ref coming over IPC is passed to git as a positional argument. It must never start with `-`
 * (git would read it as an option, e.g. `--upload-pack=...`) and must not contain whitespace.
 */
function assertSafeGitRef(ref: unknown, argumentName: string): asserts ref is string {
  if (typeof ref !== 'string' || !SAFE_GIT_REF_PATTERN.test(ref)) {
    throw new Error(`Invalid git ref for "${argumentName}".`);
  }
}

function assertNonNegativeInteger(value: unknown, argumentName: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid number for "${argumentName}".`);
  }
}

/**
 * The search text is the value of one `--grep=` argument, so git can never read it as an option. It is matched as
 * literal text (`--fixed-strings`), ignoring case.
 */
function buildHistorySearchArguments(searchText: unknown): string[] {
  if (searchText === undefined || searchText === '') {
    return [];
  }
  if (
    typeof searchText !== 'string' ||
    searchText.length > MAXIMUM_HISTORY_SEARCH_LENGTH ||
    searchText.includes('\0')
  ) {
    throw new Error('Invalid value for "searchText".');
  }
  return [`--grep=${searchText}`, '--fixed-strings', '--regexp-ignore-case'];
}

/**
 * Argument lists for the read-only history commands. They validate every value that crosses IPC before it reaches git.
 *
 * `--decorate=full` makes ref decorations independent of the user's `log.decorate`; `--no-show-signature` keeps
 * signature check output out of the parsed format; the trailing `--` stops git from reading a file called `HEAD` as
 * a path.
 */
function buildHistoryLogArguments(request: SourceControlHistoryRequest): string[] {
  assertNonNegativeInteger(request.skip, 'skip');
  assertNonNegativeInteger(request.maxCount, 'maxCount');
  return [
    'log',
    '--first-parent',
    '--no-color',
    '--no-show-signature',
    '--decorate=full',
    `--format=${GIT_HISTORY_LOG_FORMAT}`,
    `--max-count=${request.maxCount}`,
    `--skip=${request.skip}`,
    ...buildHistorySearchArguments(request.searchText),
    'HEAD',
    '--',
  ];
}

/** `<revision>:<path>` is one argument, so paths with spaces need no quoting. */
function buildShowFileArguments(revision: string, relativePath: string): string[] {
  assertSafeGitRef(revision, 'revision');
  return [`${revision}:${relativePath}`];
}

function buildUnpushedCommitsArguments(upstream: string): string[] {
  assertSafeGitRef(upstream, 'upstream');
  return ['rev-list', `${upstream}..HEAD`, '--'];
}

/**
 * `fromRef` null lists everything the commit `toRef` added (root commit). `-z` gives NUL-separated records, so paths
 * with spaces or non-ASCII characters are never quoted by git.
 */
function buildNameStatusArguments(fromRef: string | null, toRef: string): string[] {
  if (fromRef !== null) {
    assertSafeGitRef(fromRef, 'fromRef');
  }
  assertSafeGitRef(toRef, 'toRef');

  if (fromRef === null) {
    return ['diff-tree', '--root', '-r', '-M', '-z', '--no-commit-id', '--name-status', toRef, '--'];
  }
  return ['diff', '--name-status', '-M', '-z', fromRef, toRef, '--'];
}

function buildMergeBaseArguments(firstRef: string, secondRef: string): string[] {
  assertSafeGitRef(firstRef, 'firstRef');
  assertSafeGitRef(secondRef, 'secondRef');
  return ['merge-base', firstRef, secondRef];
}

/** Maps one column of `git status --porcelain` (index or working tree) to a status code; blank means unchanged. */
function mapStatusCode(code: string): SourceControlFileStatusCode | null {
  switch (code.trim()) {
    case 'M':
      return 'modified';
    case 'A':
      return 'added';
    case 'D':
      return 'deleted';
    case 'R':
      return 'renamed';
    case 'C':
      return 'copied';
    case '?':
      return 'untracked';
    case '!':
      return 'ignored';
    case 'U':
      return 'conflicted';
    case '':
      return null;
    default:
      return 'modified';
  }
}

const MERGE_SUBJECT_PATTERNS: readonly { pattern: RegExp; stripRemoteName: boolean }[] = [
  { pattern: /^Merge remote-tracking branch '([^']+)'/, stripRemoteName: true },
  { pattern: /^Merge branch '([^']+)'/, stripRemoteName: false },
  { pattern: /^Merge pull request #\d+ from (\S+)/, stripRemoteName: true },
];

/**
 * Names the branch a merge commit brought in, from the subject git or the hosting service generated.
 * Returns `null` for subjects that do not follow a known pattern (the entry is then shown as a plain "Merge").
 */
function extractMergedBranchName(subject: string): string | null {
  for (const { pattern, stripRemoteName } of MERGE_SUBJECT_PATTERNS) {
    const match = pattern.exec(subject);
    if (match) {
      // "origin/feature/x" and "owner/feature/x" both carry a leading remote or owner segment
      return stripRemoteName ? match[1].replace(/^[^/]+\//, '') : match[1];
    }
  }
  return null;
}

const LOCAL_BRANCH_PREFIX = 'refs/heads/';
const REMOTE_BRANCH_PREFIX = 'refs/remotes/';
const TAG_PREFIX = 'tag: refs/tags/';

/**
 * Turns the full-form `%D` decoration string of one commit (`--decorate=full`) into the badges the history shows: the
 * checked-out branch, other local branches, the upstream branch and tags. Everything else (other remote refs,
 * `origin/HEAD`, stash, replace refs, the `grafted` marker of shallow clones) is dropped to keep rows calm.
 */
function parseRefDecorations(decorations: string, upstream: string | null): SourceControlRefDecoration[] {
  const head: SourceControlRefDecoration[] = [];
  const locals: SourceControlRefDecoration[] = [];
  const remotes: SourceControlRefDecoration[] = [];
  const tags: SourceControlRefDecoration[] = [];

  for (const rawDecoration of decorations.split(', ')) {
    const decoration = rawDecoration.trim();

    if (decoration === 'HEAD') {
      head.push({ kind: 'head', name: 'HEAD' });
    } else if (decoration.startsWith(`HEAD -> ${LOCAL_BRANCH_PREFIX}`)) {
      head.push({ kind: 'head', name: decoration.substring(`HEAD -> ${LOCAL_BRANCH_PREFIX}`.length) });
    } else if (decoration.startsWith(LOCAL_BRANCH_PREFIX)) {
      locals.push({ kind: 'local', name: decoration.substring(LOCAL_BRANCH_PREFIX.length) });
    } else if (decoration.startsWith(REMOTE_BRANCH_PREFIX)) {
      const name = decoration.substring(REMOTE_BRANCH_PREFIX.length);
      if (name === upstream) {
        remotes.push({ kind: 'remote', name });
      }
    } else if (decoration.startsWith(TAG_PREFIX)) {
      tags.push({ kind: 'tag', name: decoration.substring(TAG_PREFIX.length) });
    }
  }

  return [...head, ...locals, ...remotes, ...tags];
}

/**
 * Parses the output of `git log --first-parent` in the `GIT_HISTORY_LOG_FORMAT` format.
 */
function parseHistoryOutput(
  logOutput: string,
  unpushedHashes: readonly string[],
  upstream: string | null,
): SourceControlHistoryEntry[] {
  const unpushedHashSet = new Set(unpushedHashes);
  const entries: SourceControlHistoryEntry[] = [];

  for (const record of logOutput.split(GIT_HISTORY_RECORD_SEPARATOR)) {
    const fields = record.replace(/^\s+/, '').split(GIT_HISTORY_FIELD_SEPARATOR);
    if (fields.length < 6 || fields[0] === '') {
      continue;
    }

    const [hash, parentField, author, date, decorations, ...subjectParts] = fields;
    const parents = parentField === '' ? [] : parentField.split(' ');
    const subject = subjectParts.join(GIT_HISTORY_FIELD_SEPARATOR);

    entries.push({
      hash,
      parents,
      author,
      date,
      subject,
      refs: parseRefDecorations(decorations, upstream),
      isUnpushed: unpushedHashSet.has(hash),
      mergedBranchName: parents.length > 1 ? extractMergedBranchName(subject) : null,
    });
  }

  return entries;
}

function mapNameStatusLetter(letter: string): SourceControlChangedFileStatus {
  switch (letter) {
    case 'A':
    case 'C':
      return 'added';
    case 'D':
      return 'deleted';
    case 'R':
      return 'renamed';
    default:
      // M and T (type change)
      return 'modified';
  }
}

/**
 * Parses `git diff --name-status -z` output: `<status>\0<path>\0`, renames and copies as
 * `<status><score>\0<oldPath>\0<newPath>\0`.
 */
function parseNameStatus(raw: string): SourceControlChangedFile[] {
  const tokens = raw.split('\0');
  const files: SourceControlChangedFile[] = [];

  let index = 0;
  while (index < tokens.length) {
    const statusToken = tokens[index].trim();
    index++;
    if (statusToken === '') {
      continue;
    }

    const letter = statusToken[0];
    if (letter === 'R' || letter === 'C') {
      const previousPath = tokens[index];
      const filePath = tokens[index + 1];
      index += 2;
      if (previousPath === undefined || filePath === undefined) {
        break;
      }
      files.push({
        status: mapNameStatusLetter(letter),
        path: filePath,
        previousPath: letter === 'R' ? previousPath : null,
      });
    } else {
      const filePath = tokens[index];
      index++;
      if (filePath === undefined) {
        break;
      }
      files.push({ status: mapNameStatusLetter(letter), path: filePath, previousPath: null });
    }
  }

  return files;
}

function createGit(options: Partial<SimpleGitOptions> = {}): SimpleGit {
  return simpleGit({ ...options, allowEnvironment: ['GIT_TERMINAL_PROMPT'] });
}

function getGit(cwd: string): SimpleGit {
  return createGit({ baseDir: cwd });
}

async function moveDirectory(source: string, destination: string): Promise<void> {
  try {
    await fs.rename(source, destination);
  } catch (error: any) {
    if (error.code !== 'EXDEV') {
      throw error;
    }
    await fs.cp(source, destination, { recursive: true });
    await fs.rm(source, { recursive: true, force: true });
  }
}

export function registerGitHandlers(): void {
  process.env.GIT_TERMINAL_PROMPT = '0';
  ipcMain.handle(IPC_INVOKE_GIT_IS_AVAILABLE, async () => {
    try {
      const git = createGit();
      const version = await git.version();
      return { available: true, version: version.toString() };
    } catch {
      return { available: false, version: null };
    }
  });

  ipcMain.handle(IPC_INVOKE_GIT_IS_REPO, async (_event, cwd: string) => {
    try {
      const git = getGit(cwd);
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        return { isRepo: false, root: null };
      }
      const root = await git.revparse(['--show-toplevel']);
      return { isRepo: true, root: root.trim() };
    } catch {
      return { isRepo: false, root: null };
    }
  });

  ipcMain.handle(IPC_INVOKE_GIT_STATUS, async (_event, cwd: string): Promise<GitStatusPayload> => {
    const git = getGit(cwd);
    const status: StatusResult = await git.status();

    const branchSummary: BranchSummary = await git.branch();
    const current = branchSummary.current;
    const detached = branchSummary.detached;

    let tracking: string | null;
    let ahead = 0;
    let behind = 0;

    try {
      const trackingBranch = await git.revparse(['--abbrev-ref', `${current}@{upstream}`]);
      tracking = trackingBranch.trim() || null;
    } catch {
      tracking = null;
    }

    if (tracking) {
      try {
        const revList = await git.raw(['rev-list', '--left-right', '--count', `${current}...${tracking}`]);
        const parts = revList.trim().split(/\s+/);
        ahead = parseInt(parts[0] ?? '0', 10);
        behind = parseInt(parts[1] ?? '0', 10);
      } catch {
        // ignore — no upstream info available
      }
    }

    let hasStash: boolean;
    try {
      const stashList = await git.stashList();
      hasStash = stashList.total > 0;
    } catch {
      hasStash = false;
    }

    const conflictedPaths = new Set(status.conflicted);

    return {
      branch: { current, tracking, ahead, behind, detached },
      files: status.files.map((file) => ({
        path: file.path,
        indexStatus: mapStatusCode(file.index),
        workingTreeStatus: mapStatusCode(file.working_dir),
        previousPath: file.from ?? null,
        isConflicted: conflictedPaths.has(file.path),
      })),
      hasStash,
    };
  });

  ipcMain.handle(IPC_INVOKE_GIT_STAGE, async (_event, cwd: string, filePaths: string[]) => {
    const git = getGit(cwd);
    await git.add(filePaths);
  });

  ipcMain.handle(IPC_INVOKE_GIT_UNSTAGE, async (_event, cwd: string, filePaths: string[]) => {
    const git = getGit(cwd);
    await git.reset(['HEAD', '--', ...filePaths]);
  });

  ipcMain.handle(IPC_INVOKE_GIT_COMMIT, async (_event, cwd: string, message: string) => {
    const git = getGit(cwd);
    const result = await git.commit(message);
    return { hash: result.commit, summary: result.summary };
  });

  ipcMain.handle(IPC_INVOKE_GIT_PUSH, async (_event, cwd: string, options?: { setUpstream?: boolean }) => {
    const git = getGit(cwd);
    const currentBranch = (await git.branch()).current;

    let hasUpstream = false;
    if (!options?.setUpstream) {
      try {
        await git.revparse(['--abbrev-ref', `${currentBranch}@{upstream}`]);
        hasUpstream = true;
      } catch {
        hasUpstream = false;
      }
    }

    if (options?.setUpstream || !hasUpstream) {
      await git.push(['--set-upstream', 'origin', currentBranch]);
    } else {
      await git.push();
    }
  });

  ipcMain.handle(IPC_INVOKE_GIT_PULL, async (_event, cwd: string, options?: { rebase?: boolean }) => {
    const git = getGit(cwd);
    if (options?.rebase) {
      await git.pull(['--rebase']);
    } else {
      await git.pull();
    }
  });

  ipcMain.handle(IPC_INVOKE_GIT_FETCH, async (_event, cwd: string) => {
    const git = getGit(cwd);
    await git.fetch();
  });

  ipcMain.handle(IPC_INVOKE_GIT_REVERT, async (_event, cwd: string, filePaths: string[]) => {
    const git = getGit(cwd);
    await git.checkout(['--', ...filePaths]);
  });

  ipcMain.handle(IPC_INVOKE_GIT_STASH, async (_event, cwd: string, message?: string) => {
    const git = getGit(cwd);
    if (message) {
      await git.stash(['push', '-m', message]);
    } else {
      await git.stash(['push']);
    }
  });

  ipcMain.handle(
    IPC_INVOKE_GIT_STASH_APPLY,
    async (_event, cwd: string, index?: number, options?: { restoreIndex?: boolean }) => {
      const git = getGit(cwd);
      const args = ['pop'];
      if (options?.restoreIndex) {
        args.push('--index');
      }
      if (index != null) {
        args.push(`stash@{${index}}`);
      }
      await git.stash(args);
    },
  );

  ipcMain.handle(IPC_INVOKE_GIT_STASH_LIST, async (_event, cwd: string) => {
    const git = getGit(cwd);
    const stashList = await git.stashList();
    return stashList.all.map((entry, i) => ({
      index: i,
      message: entry.message,
      date: entry.date,
    }));
  });

  ipcMain.handle(IPC_INVOKE_GIT_BRANCH_LIST, async (_event, cwd: string) => {
    const git = getGit(cwd);
    const summary: BranchSummary = await git.branch(['-a']);
    return {
      current: summary.current,
      branches: Object.values(summary.branches).map((branch) => ({
        name: branch.name,
        current: branch.current,
        commit: branch.commit,
        label: branch.label,
      })),
    };
  });

  ipcMain.handle(IPC_INVOKE_GIT_BRANCH_SWITCH, async (_event, cwd: string, branchName: string) => {
    const git = getGit(cwd);
    await git.checkout(branchName);
  });

  ipcMain.handle(IPC_INVOKE_GIT_BRANCH_CREATE, async (_event, cwd: string, branchName: string, checkout: boolean) => {
    const git = getGit(cwd);
    if (checkout) {
      await git.checkoutLocalBranch(branchName);
    } else {
      await git.branch([branchName]);
    }
  });

  ipcMain.handle(
    IPC_INVOKE_GIT_SHOW,
    async (_event, cwd: string, revision: string, relativePath: string): Promise<string> =>
      await getGit(cwd).show(buildShowFileArguments(revision, relativePath)),
  );

  ipcMain.handle(IPC_INVOKE_GIT_LOG, async (_event, cwd: string, options?: { maxCount?: number; file?: string }) => {
    const git = getGit(cwd);
    const logOptions: string[] = [];
    if (options?.maxCount) {
      logOptions.push(`-n${options.maxCount}`);
    }
    if (options?.file) {
      logOptions.push('--', options.file);
    }

    const log: LogResult = await git.log(logOptions);
    return log.all.map((entry) => ({
      hash: entry.hash,
      date: entry.date,
      message: entry.message,
      author: entry.author_name,
    }));
  });

  ipcMain.handle(
    IPC_INVOKE_GIT_HISTORY,
    async (_event, cwd: string, request: SourceControlHistoryRequest): Promise<SourceControlHistoryEntry[]> => {
      const logArguments = buildHistoryLogArguments(request);
      const unpushedArguments = request.upstream === null ? null : buildUnpushedCommitsArguments(request.upstream);

      const git = getGit(cwd);
      try {
        await git.raw(['rev-parse', '--verify', 'HEAD']);
      } catch {
        // no commits yet
        return [];
      }

      const logOutput = await git.raw(logArguments);

      let unpushedHashes: string[] = [];
      if (unpushedArguments !== null) {
        try {
          const revList = await git.raw(unpushedArguments);
          unpushedHashes = revList.split('\n').filter((line) => line.length > 0);
        } catch {
          // upstream ref no longer exists — treat as "no unpushed information"
        }
      }

      return parseHistoryOutput(logOutput, unpushedHashes, request.upstream);
    },
  );

  ipcMain.handle(
    IPC_INVOKE_GIT_DIFF_NAME_STATUS,
    async (_event, cwd: string, fromRef: string | null, toRef: string): Promise<SourceControlChangedFile[]> =>
      parseNameStatus(await getGit(cwd).raw(buildNameStatusArguments(fromRef, toRef))),
  );

  ipcMain.handle(
    IPC_INVOKE_GIT_MERGE_BASE,
    async (_event, cwd: string, firstRef: string, secondRef: string): Promise<string | null> => {
      const mergeBaseArguments = buildMergeBaseArguments(firstRef, secondRef);
      try {
        const mergeBase = await getGit(cwd).raw(mergeBaseArguments);
        return mergeBase.trim() || null;
      } catch {
        return null;
      }
    },
  );

  ipcMain.handle(IPC_INVOKE_GIT_MERGE_STATE, async (_event, cwd: string) => {
    const git = getGit(cwd);

    try {
      await git.raw(['rev-parse', '--verify', 'MERGE_HEAD']);
      return { kind: 'merge' };
    } catch {
      // not in a merge
    }

    try {
      await git.raw(['rev-parse', '--verify', 'REBASE_HEAD']);
      return { kind: 'rebase' };
    } catch {
      // not in a rebase
    }

    try {
      await git.raw(['rev-parse', '--verify', 'CHERRY_PICK_HEAD']);
      return { kind: 'cherry-pick' };
    } catch {
      // not in a cherry-pick
    }

    return { kind: null };
  });

  ipcMain.handle(IPC_INVOKE_GIT_MERGE_ABORT, async (_event, cwd: string) => {
    const git = getGit(cwd);
    await git.merge(['--abort']);
  });

  ipcMain.handle(IPC_INVOKE_GIT_REBASE_ABORT, async (_event, cwd: string) => {
    const git = getGit(cwd);
    await git.rebase(['--abort']);
  });

  ipcMain.handle(IPC_INVOKE_GIT_REBASE_CONTINUE, async (_event, cwd: string) => {
    const git = getGit(cwd);
    await git.rebase(['--continue']);
  });

  ipcMain.handle(IPC_INVOKE_GIT_CHERRY_PICK_ABORT, async (_event, cwd: string) => {
    const git = getGit(cwd);
    await git.raw(['cherry-pick', '--abort']);
  });

  ipcMain.handle(IPC_INVOKE_GIT_CHERRY_PICK_CONTINUE, async (_event, cwd: string) => {
    const git = getGit(cwd);
    await git.raw(['cherry-pick', '--continue']);
  });

  ipcMain.handle(IPC_INVOKE_GIT_CONFLICT_BLOBS, async (_event, cwd: string, filePath: string) => {
    const git = getGit(cwd);

    async function showStage(stage: number): Promise<string | null> {
      try {
        return await git.show([`:${stage}:${filePath}`]);
      } catch {
        return null;
      }
    }

    const [base, ours, theirs] = await Promise.all([showStage(1), showStage(2), showStage(3)]);
    return { base, ours, theirs };
  });

  ipcMain.handle(IPC_INVOKE_GIT_REMOVE, async (_event, cwd: string, filePaths: string[]) => {
    const git = getGit(cwd);
    await git.rm(filePaths);
  });

  ipcMain.handle(IPC_INVOKE_GIT_CLONE, async (event, url: string, targetDir: string, branch?: string) => {
    const git = createGit({
      timeout: { block: 30000 },
      progress({ stage, progress }) {
        event.sender.send(IPC_MESSAGE_GIT_CLONE_PROGRESS, { stage, progress });
      },
    });
    const args = branch ? ['--branch', branch] : [];
    await git.clone(url, targetDir, args);
  });

  ipcMain.handle(IPC_INVOKE_GIT_LS_REMOTE, async (_event, url: string) => {
    const git = createGit({ timeout: { block: 15000 } });
    const output = await git.listRemote(['--heads', '--symref', url]);

    const branches: { name: string; isHead: boolean }[] = [];
    let headTarget: string | null = null;

    for (const rawLine of output.split('\n')) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }
      const symrefMatch = line.match(/^ref:\s+refs\/heads\/(\S+)\s+HEAD$/);
      if (symrefMatch) {
        headTarget = symrefMatch[1];
        continue;
      }
      const branchMatch = line.match(/^[0-9a-f]+\s+refs\/heads\/(.+)$/);
      if (branchMatch) {
        branches.push({ name: branchMatch[1], isHead: false });
      }
    }

    if (headTarget) {
      const headEntry = branches.find((branch) => branch.name === headTarget);
      if (headEntry) {
        headEntry.isHead = true;
      }
    } else if (branches.length > 0) {
      branches[0].isHead = true;
    }

    return { branches };
  });

  ipcMain.handle(
    IPC_INVOKE_GIT_CONNECT_TO_REMOTE,
    async (event, url: string, targetDir: string, branch: string, newBranch?: string) => {
      const tempDir = path.join(os.tmpdir(), `bifrost-forge-world-connect-${Date.now()}`);

      try {
        const cloneGit = createGit({
          timeout: { block: 60000 },
          progress({ stage, progress }) {
            event.sender.send(IPC_MESSAGE_GIT_CLONE_PROGRESS, { stage, progress });
          },
        });
        await cloneGit.clone(url, tempDir, ['--branch', branch]);

        if (newBranch) {
          const tempGit = getGit(tempDir);
          const branchInfo = await tempGit.branch(['-a']);
          const existsOnRemote = branchInfo.all.some((ref) => ref === `remotes/origin/${newBranch}`);
          if (existsOnRemote) {
            await tempGit.checkout(newBranch);
          } else {
            await tempGit.checkoutLocalBranch(newBranch);
          }
        }

        const sourceGitDir = path.join(tempDir, '.git');
        const destGitDir = path.join(targetDir, '.git');
        await moveDirectory(sourceGitDir, destGitDir);

        const targetGit = getGit(targetDir);
        await targetGit.reset(['HEAD']);

        const status = await targetGit.status();
        const deletedFiles = status.deleted;
        if (deletedFiles.length > 0) {
          await targetGit.checkout(['HEAD', '--', ...deletedFiles]);
        }
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    },
  );
}
