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
  IPC_INVOKE_GIT_FETCH,
  IPC_INVOKE_GIT_IS_AVAILABLE,
  IPC_INVOKE_GIT_IS_REPO,
  IPC_INVOKE_GIT_LOG,
  IPC_INVOKE_GIT_LS_REMOTE,
  IPC_INVOKE_GIT_MERGE_ABORT,
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
} from '#modules/git-cruiser/GitIpcChannels';
import { ipcMain } from 'electron';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import type { BranchSummary, LogResult, SimpleGit, StatusResult } from 'simple-git';
import simpleGit from 'simple-git';

function getGit(cwd: string): SimpleGit {
  return simpleGit(cwd);
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
      const git = simpleGit();
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

  ipcMain.handle(IPC_INVOKE_GIT_STATUS, async (_event, cwd: string) => {
    const git = getGit(cwd);
    const status: StatusResult = await git.status();

    const branchSummary: BranchSummary = await git.branch();
    const current = branchSummary.current;
    const detached = branchSummary.detached;

    let tracking: string | null = null;
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

    let hasStash = false;
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
        indexStatus: file.index,
        workingTreeStatus: file.working_dir,
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

  ipcMain.handle(IPC_INVOKE_GIT_SHOW, async (_event, cwd: string, ref: string) => {
    const git = getGit(cwd);
    return await git.show([ref]);
  });

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
    const git = simpleGit({
      timeout: { block: 30000 },
      progress({ stage, progress }) {
        event.sender.send(IPC_MESSAGE_GIT_CLONE_PROGRESS, { stage, progress });
      },
    });
    const args = branch ? ['--branch', branch] : [];
    await git.clone(url, targetDir, args);
  });

  ipcMain.handle(IPC_INVOKE_GIT_LS_REMOTE, async (_event, url: string) => {
    const git = simpleGit({ timeout: { block: 15000 } });
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
        const cloneGit = simpleGit({
          timeout: { block: 60000 },
          progress({ stage, progress }) {
            event.sender.send(IPC_MESSAGE_GIT_CLONE_PROGRESS, { stage, progress });
          },
        });
        await cloneGit.clone(url, tempDir, ['--branch', branch]);

        if (newBranch) {
          const tempGit = simpleGit(tempDir);
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
