import type {
  SourceControlChangedFile,
  SourceControlChangedFileStatus,
  SourceControlFileStatusCode,
  SourceControlHistoryEntry,
  SourceControlHistoryRequest,
  SourceControlRefDecoration,
} from '#bifrost/contracts/SourceControlTypes';

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
 * Argument lists for the read-only history commands. They validate every value that crosses IPC, so the handlers and
 * the tests share exactly one definition of what is passed to git.
 *
 * `--decorate=full` makes ref decorations independent of the user's `log.decorate`; `--no-show-signature` keeps
 * signature check output out of the parsed format; the trailing `--` stops git from reading a file called `HEAD` as
 * a path.
 */
export function buildHistoryLogArguments(request: SourceControlHistoryRequest): string[] {
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
    'HEAD',
    '--',
  ];
}

/** `<revision>:<path>` is one argument, so paths with spaces need no quoting. */
export function buildShowFileArguments(revision: string, relativePath: string): string[] {
  assertSafeGitRef(revision, 'revision');
  return [`${revision}:${relativePath}`];
}

export function buildUnpushedCommitsArguments(upstream: string): string[] {
  assertSafeGitRef(upstream, 'upstream');
  return ['rev-list', `${upstream}..HEAD`, '--'];
}

/**
 * `fromRef` null lists everything the commit `toRef` added (root commit). `-z` gives NUL-separated records, so paths
 * with spaces or non-ASCII characters are never quoted by git.
 */
export function buildNameStatusArguments(fromRef: string | null, toRef: string): string[] {
  if (fromRef !== null) {
    assertSafeGitRef(fromRef, 'fromRef');
  }
  assertSafeGitRef(toRef, 'toRef');

  if (fromRef === null) {
    return ['diff-tree', '--root', '-r', '-M', '-z', '--no-commit-id', '--name-status', toRef, '--'];
  }
  return ['diff', '--name-status', '-M', '-z', fromRef, toRef, '--'];
}

export function buildMergeBaseArguments(firstRef: string, secondRef: string): string[] {
  assertSafeGitRef(firstRef, 'firstRef');
  assertSafeGitRef(secondRef, 'secondRef');
  return ['merge-base', firstRef, secondRef];
}

/** Maps one column of `git status --porcelain` (index or working tree) to a status code; blank means unchanged. */
export function mapStatusCode(code: string): SourceControlFileStatusCode | null {
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
export function parseHistoryOutput(
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
export function parseNameStatus(raw: string): SourceControlChangedFile[] {
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
      const path = tokens[index + 1];
      index += 2;
      if (previousPath === undefined || path === undefined) {
        break;
      }
      files.push({
        status: mapNameStatusLetter(letter),
        path,
        previousPath: letter === 'R' ? previousPath : null,
      });
    } else {
      const path = tokens[index];
      index++;
      if (path === undefined) {
        break;
      }
      files.push({ status: mapNameStatusLetter(letter), path, previousPath: null });
    }
  }

  return files;
}
