import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildHistoryLogArguments,
  buildMergeBaseArguments,
  buildNameStatusArguments,
  buildShowFileArguments,
  buildUnpushedCommitsArguments,
  mapStatusCode,
  parseHistoryOutput,
  parseNameStatus,
} from '../../../src/bifrost/electron-main/git/gitCommandLine';

// Written as literals on purpose: a change of the log format must fail this test.
const FIELD = '\x1f';
const RECORD = '\x1e';

function logRecord(fields: { hash: string; parents?: string; decorations?: string; subject?: string }): string {
  const { hash, parents = '', decorations = '', subject = 'A commit' } = fields;
  return [hash, parents, 'Ada', '2026-10-01T10:00:00+02:00', decorations, subject].join(FIELD) + RECORD;
}

function refsOf(decorations: string, upstream: string | null): unknown {
  return parseHistoryOutput(logRecord({ hash: 'a', decorations }), [], upstream)[0].refs;
}

function mergedBranchNameOf(subject: string): string | null {
  return parseHistoryOutput(logRecord({ hash: 'a', parents: 'b c', subject }), [], null)[0].mergedBranchName;
}

describe('mapStatusCode', () => {
  it.each([
    ['M', 'modified'],
    ['A', 'added'],
    ['D', 'deleted'],
    ['R', 'renamed'],
    ['C', 'copied'],
    ['?', 'untracked'],
    ['!', 'ignored'],
    ['U', 'conflicted'],
    ['T', 'modified'],
  ])('maps %j to %s', (code, expected) => {
    expect(mapStatusCode(code)).toBe(expected);
  });

  it('treats a blank column as unchanged', () => {
    expect(mapStatusCode(' ')).toBeNull();
    expect(mapStatusCode('')).toBeNull();
  });
});

describe('parseHistoryOutput: merged branch names', () => {
  it.each([
    ["Merge branch 'feature/escalation'", 'feature/escalation'],
    ["Merge branch 'feature/escalation' into main", 'feature/escalation'],
    ["Merge branch 'hotfix' of github.com:owner/repo into main", 'hotfix'],
    ["Merge remote-tracking branch 'origin/feature/escalation'", 'feature/escalation'],
    ['Merge pull request #12 from owner/feature/escalation', 'feature/escalation'],
  ])('reads %j', (subject, expected) => {
    expect(mergedBranchNameOf(subject)).toBe(expected);
  });

  it.each(['Add payment model', "Merge tag 'v1.0'", 'Merge', ''])('returns null for %j', (subject) => {
    expect(mergedBranchNameOf(subject)).toBeNull();
  });
});

describe('parseHistoryOutput: ref decorations', () => {
  it('keeps the checked-out branch, other local branches, the upstream and tags, in that order', () => {
    expect(
      refsOf(
        'tag: refs/tags/v1.0, refs/remotes/origin/main, refs/heads/feature/x, HEAD -> refs/heads/main',
        'origin/main',
      ),
    ).toEqual([
      { kind: 'head', name: 'main' },
      { kind: 'local', name: 'feature/x' },
      { kind: 'remote', name: 'origin/main' },
      { kind: 'tag', name: 'v1.0' },
    ]);
  });

  it('drops other remote refs, origin/HEAD, stash refs and the shallow-clone marker', () => {
    expect(
      refsOf(
        'refs/remotes/origin/HEAD, refs/remotes/origin/other, refs/remotes/origin/main, refs/stash, grafted',
        'origin/main',
      ),
    ).toEqual([{ kind: 'remote', name: 'origin/main' }]);
    expect(refsOf('refs/remotes/origin/main', null)).toEqual([]);
  });

  it('does not mistake a local branch named like a remote branch for a remote ref', () => {
    expect(refsOf('refs/heads/origin/fake', 'origin/main')).toEqual([{ kind: 'local', name: 'origin/fake' }]);
  });

  it('reports a detached HEAD', () => {
    expect(refsOf('HEAD', null)).toEqual([{ kind: 'head', name: 'HEAD' }]);
  });

  it('returns nothing for an undecorated commit', () => {
    expect(refsOf('', 'origin/main')).toEqual([]);
  });
});

describe('parseHistoryOutput', () => {
  it('parses commits, parents, refs and the unpushed marker; merges carry the merged branch name', () => {
    const logOutput =
      logRecord({
        hash: 'c3',
        parents: 'c2 b1',
        decorations: 'HEAD -> refs/heads/main',
        subject: "Merge branch 'feature/x'",
      }) +
      '\n' +
      logRecord({
        hash: 'c2',
        parents: 'c1',
        decorations: 'refs/remotes/origin/main, tag: refs/tags/v1',
        subject: 'Second',
      }) +
      '\n' +
      logRecord({ hash: 'c1', parents: '', subject: 'Root' });

    const entries = parseHistoryOutput(logOutput, ['c3'], 'origin/main');

    expect(entries.map((entry) => entry.hash)).toEqual(['c3', 'c2', 'c1']);
    expect(entries[0]).toMatchObject({
      parents: ['c2', 'b1'],
      author: 'Ada',
      date: '2026-10-01T10:00:00+02:00',
      isUnpushed: true,
      mergedBranchName: 'feature/x',
      refs: [{ kind: 'head', name: 'main' }],
    });
    expect(entries[1]).toMatchObject({
      isUnpushed: false,
      mergedBranchName: null,
      refs: [
        { kind: 'remote', name: 'origin/main' },
        { kind: 'tag', name: 'v1' },
      ],
    });
    expect(entries[2]).toMatchObject({ parents: [], subject: 'Root' });
  });

  it('does not name a branch for a single-parent commit whose subject looks like a merge', () => {
    const entries = parseHistoryOutput(logRecord({ hash: 'a', parents: 'b', subject: "Merge branch 'x'" }), [], null);
    expect(entries[0].mergedBranchName).toBeNull();
  });

  it('returns an empty list for empty output', () => {
    expect(parseHistoryOutput('', [], null)).toEqual([]);
    expect(parseHistoryOutput('\n', [], null)).toEqual([]);
  });
});

describe('parseNameStatus', () => {
  it('parses added, modified, deleted and type-changed files', () => {
    expect(parseNameStatus('A\0new.bpmn\0M\0changed.dmn\0D\0gone.json\0T\0link.txt\0')).toEqual([
      { status: 'added', path: 'new.bpmn', previousPath: null },
      { status: 'modified', path: 'changed.dmn', previousPath: null },
      { status: 'deleted', path: 'gone.json', previousPath: null },
      { status: 'modified', path: 'link.txt', previousPath: null },
    ]);
  });

  it('parses renames with both paths and copies as added files', () => {
    expect(parseNameStatus('R087\0old name.bpmn\0new name.bpmn\0C100\0source.txt\0copy.txt\0')).toEqual([
      { status: 'renamed', path: 'new name.bpmn', previousPath: 'old name.bpmn' },
      { status: 'added', path: 'copy.txt', previousPath: null },
    ]);
  });

  it('returns an empty list for empty output and ignores a truncated record', () => {
    expect(parseNameStatus('')).toEqual([]);
    expect(parseNameStatus('R100\0only-old.txt')).toEqual([]);
  });
});

describe('git command argument builders', () => {
  it('builds a history log command that is independent of user configuration', () => {
    const logArguments = buildHistoryLogArguments({ skip: 200, maxCount: 100, upstream: null });
    expect(logArguments).toEqual(
      expect.arrayContaining([
        '--first-parent',
        '--decorate=full',
        '--no-show-signature',
        '--format=%H%x1f%P%x1f%an%x1f%aI%x1f%D%x1f%s%x1e',
        '--max-count=100',
        '--skip=200',
      ]),
    );
    expect(logArguments.slice(-2)).toEqual(['HEAD', '--']);
  });

  it('joins revision and path into one show argument', () => {
    expect(buildShowFileArguments('HEAD', 'folder/rule table.dmn')).toEqual(['HEAD:folder/rule table.dmn']);
  });

  it('builds the root-commit and range name-status commands', () => {
    expect(buildNameStatusArguments(null, 'abc')).toEqual([
      'diff-tree',
      '--root',
      '-r',
      '-M',
      '-z',
      '--no-commit-id',
      '--name-status',
      'abc',
      '--',
    ]);
    expect(buildNameStatusArguments('abc', 'def')).toEqual(['diff', '--name-status', '-M', '-z', 'abc', 'def', '--']);
  });

  it('builds the unpushed and merge-base commands', () => {
    expect(buildUnpushedCommitsArguments('origin/main')).toEqual(['rev-list', 'origin/main..HEAD', '--']);
    expect(buildMergeBaseArguments('main', 'HEAD')).toEqual(['merge-base', 'main', 'HEAD']);
  });
});

describe('git command argument validation', () => {
  it.each([
    'HEAD',
    'main',
    'origin/main',
    'feature/escalation',
    'v1.0.0',
    'HEAD^',
    'HEAD~2',
    '3f2a9c1',
    'a'.repeat(40),
  ])('accepts the ref %s', (ref) => {
    expect(buildMergeBaseArguments(ref, 'HEAD')).toEqual(['merge-base', ref, 'HEAD']);
  });

  it.each([
    '--upload-pack=touch /tmp/pwned',
    '-n1',
    '--output=file',
    '',
    ' main',
    'a b',
    'main\nother',
    'main\t',
    null,
    undefined,
    42,
    ['main'],
  ])('rejects the ref %j and names the argument', (ref) => {
    expect(() => buildMergeBaseArguments(ref as string, 'HEAD')).toThrow('Invalid git ref for "firstRef".');
  });

  it('names the argument that failed in every builder', () => {
    expect(() => buildUnpushedCommitsArguments('--output=x')).toThrow('"upstream"');
    expect(() => buildNameStatusArguments('--upload-pack=x', 'HEAD')).toThrow('"fromRef"');
    expect(() => buildNameStatusArguments(null, 'a b')).toThrow('"toRef"');
    expect(() => buildMergeBaseArguments('main', '-n1')).toThrow('"secondRef"');
    expect(() => buildShowFileArguments('--output=x', 'a.bpmn')).toThrow('"revision"');
  });

  it('accepts zero and positive integers for paging', () => {
    expect(() => buildHistoryLogArguments({ skip: 0, maxCount: 100, upstream: null })).not.toThrow();
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '10', null, undefined])(
    'rejects the paging value %j',
    (value) => {
      expect(() => buildHistoryLogArguments({ skip: value as number, maxCount: 100, upstream: null })).toThrow(
        'Invalid number for "skip".',
      );
      expect(() => buildHistoryLogArguments({ skip: 0, maxCount: value as number, upstream: null })).toThrow(
        'Invalid number for "maxCount".',
      );
    },
  );
});

describe('against real repositories', () => {
  let workspace: string;
  let repositoryRoot: string;

  // The user's own git configuration (log.decorate, signing, hooks, ...) must not influence the test.
  const isolatedEnvironment = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };

  function git(directory: string, ...args: string[]): string {
    return execFileSync('git', args, { cwd: directory, encoding: 'utf8', env: isolatedEnvironment });
  }

  function runHistory(directory: string, upstream: string | null = null): ReturnType<typeof parseHistoryOutput> {
    const logOutput = git(directory, ...buildHistoryLogArguments({ skip: 0, maxCount: 100, upstream }));
    const unpushed =
      upstream === null
        ? []
        : git(directory, ...buildUnpushedCommitsArguments(upstream))
            .split('\n')
            .filter(Boolean);
    return parseHistoryOutput(logOutput, unpushed, upstream);
  }

  function configureIdentity(directory: string): void {
    git(directory, 'config', 'user.name', 'Ada');
    git(directory, 'config', 'user.email', 'ada@example.com');
  }

  beforeAll(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'bifrost-git-history-'));
    repositoryRoot = path.join(workspace, 'repository');
    fs.mkdirSync(repositoryRoot);
    git(repositoryRoot, 'init', '--quiet', '--initial-branch=main');
    configureIdentity(repositoryRoot);

    fs.writeFileSync(path.join(repositoryRoot, 'process.bpmn'), '<a/>');
    fs.writeFileSync(path.join(repositoryRoot, 'rüle table.dmn'), '<a/>');
    git(repositoryRoot, 'add', '.');
    git(repositoryRoot, 'commit', '--quiet', '-m', 'Add models');
    git(repositoryRoot, 'tag', 'v1');

    git(repositoryRoot, 'checkout', '--quiet', '-b', 'feature/escalation');
    fs.writeFileSync(path.join(repositoryRoot, 'notes.txt'), 'hello');
    git(repositoryRoot, 'add', '.');
    git(repositoryRoot, 'commit', '--quiet', '-m', 'Add notes');

    git(repositoryRoot, 'checkout', '--quiet', 'main');
    fs.writeFileSync(path.join(repositoryRoot, 'process.bpmn'), '<b/>');
    git(repositoryRoot, 'commit', '--quiet', '-am', 'Change process');
    git(repositoryRoot, 'merge', '--quiet', '--no-ff', 'feature/escalation', '-m', "Merge branch 'feature/escalation'");
    git(repositoryRoot, 'mv', 'rüle table.dmn', 'rule table.dmn');
    git(repositoryRoot, 'commit', '--quiet', '-m', 'Rename table');
  });

  afterAll(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  it('parses the first-parent history with branch, merge and tag information', () => {
    const entries = runHistory(repositoryRoot);

    expect(entries.map((entry) => entry.subject)).toEqual([
      'Rename table',
      "Merge branch 'feature/escalation'",
      'Change process',
      'Add models',
    ]);
    expect(entries[0].refs).toEqual(expect.arrayContaining([{ kind: 'head', name: 'main' }]));
    expect(entries[0].refs).toEqual(expect.not.arrayContaining([{ kind: 'local', name: 'refs/heads/main' }]));
    expect(entries[1]).toMatchObject({ mergedBranchName: 'feature/escalation' });
    expect(entries[1].parents).toHaveLength(2);
    expect(entries[3]).toMatchObject({ parents: [], author: 'Ada' });
    expect(entries[3].refs).toEqual([{ kind: 'tag', name: 'v1' }]);
    expect(entries[3].date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('is independent of log.decorate and unaffected by a file named HEAD', () => {
    git(repositoryRoot, 'config', 'log.decorate', 'short');
    fs.writeFileSync(path.join(repositoryRoot, 'HEAD'), 'not a ref');
    git(repositoryRoot, 'add', 'HEAD');
    git(repositoryRoot, 'commit', '--quiet', '-m', 'Add a file called HEAD');

    const entries = runHistory(repositoryRoot);

    expect(entries[0].subject).toBe('Add a file called HEAD');
    expect(entries[0].refs).toEqual([{ kind: 'head', name: 'main' }]);
    expect(entries[1].refs).toEqual([]);

    git(repositoryRoot, 'reset', '--quiet', '--hard', 'HEAD~1');
    git(repositoryRoot, 'config', '--unset', 'log.decorate');
  });

  it('parses -z name-status output for a rename with non-ASCII path and for a root commit', () => {
    const renameOutput = git(repositoryRoot, ...buildNameStatusArguments('HEAD~1', 'HEAD'));
    expect(parseNameStatus(renameOutput)).toEqual([
      { status: 'renamed', path: 'rule table.dmn', previousPath: 'rüle table.dmn' },
    ]);

    const rootHash = git(repositoryRoot, 'rev-list', '--max-parents=0', 'HEAD').trim();
    const rootOutput = git(repositoryRoot, ...buildNameStatusArguments(null, rootHash));
    expect(parseNameStatus(rootOutput)).toEqual([
      { status: 'added', path: 'process.bpmn', previousPath: null },
      { status: 'added', path: 'rüle table.dmn', previousPath: null },
    ]);
  });

  it('shows a file with spaces in its path at a revision', () => {
    expect(git(repositoryRoot, 'show', ...buildShowFileArguments('HEAD~1', 'rüle table.dmn'))).toBe('<a/>');
  });

  it('finds the merge base of a branch and main', () => {
    const mergeBase = git(repositoryRoot, ...buildMergeBaseArguments('feature/escalation', 'main')).trim();
    expect(mergeBase).toBe(git(repositoryRoot, 'rev-parse', 'feature/escalation').trim());
  });

  it('marks unpushed commits, keeps only the upstream remote badge and ignores a shallow clone marker', () => {
    const cloneRoot = path.join(workspace, 'clone');
    git(workspace, 'clone', '--quiet', '--depth', '2', `file://${repositoryRoot}`, cloneRoot);
    configureIdentity(cloneRoot);
    git(cloneRoot, 'branch', 'origin/fake');
    fs.writeFileSync(path.join(cloneRoot, 'local.txt'), 'x');
    git(cloneRoot, 'add', '.');
    git(cloneRoot, 'commit', '--quiet', '-m', 'Local only');

    const entries = runHistory(cloneRoot, 'origin/main');

    expect(entries[0]).toMatchObject({ subject: 'Local only', isUnpushed: true });
    expect(entries[0].refs).toEqual([{ kind: 'head', name: 'main' }]);
    expect(entries[1]).toMatchObject({ isUnpushed: false });
    expect(entries[1].refs).toEqual([
      { kind: 'local', name: 'origin/fake' },
      { kind: 'remote', name: 'origin/main' },
    ]);
    expect(entries[2].refs).toEqual([]);
    const allRefNames = entries.flatMap((entry) => entry.refs.map((ref) => ref.name));
    expect(allRefNames).not.toContain('grafted');
  });
});
