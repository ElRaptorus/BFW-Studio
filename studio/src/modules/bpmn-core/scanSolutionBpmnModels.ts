import type { Bifrost } from '#bifrost/Bifrost';
import { sha256Hex } from '#bifrost/common/HashFunctions';

import type { BfwLinterRulesetScorePayload } from './bpmn-js/CommandHandler/UpdateBfwLinterRulesetScoreHandler';
import type { BpmnModelScanFile, BpmnModelScanRequest, BpmnModelScanResponse } from './parseSolutionBpmnModel';

/** A `bfw:linterRulesetScore` as stored in the file; every value is the attribute text. */
export type StoredLinterScore = BfwLinterRulesetScorePayload;

export type SolutionCallActivityEntry = {
  id: string;
  calledElement: string | null;
  calledProcessVersion: string | null;
};

/** A flow node that throws or catches a message or signal, with the resolved, non-blank name. */
export type SolutionEventNameEntry = {
  flowNodeId: string;
  name: string;
};

export type SolutionProcessEntry = {
  id: string;
  name: string | null;
  version: string | null;
  isExecutable: boolean;
  /** Includes call activities nested in subprocesses. */
  callActivities: SolutionCallActivityEntry[];
  /** `bfw:decisionRef` of every Business Rule Task, including nested ones. */
  decisionRefs: string[];
  /** Message throw and end events and send tasks, including nested ones. */
  thrownMessages: SolutionEventNameEntry[];
  /** Message start, catch and boundary events and receive tasks, including nested ones. */
  caughtMessages: SolutionEventNameEntry[];
  /** Signal throw and end events, including nested ones. */
  thrownSignals: SolutionEventNameEntry[];
  /** Signal start, catch and boundary events, including nested ones. */
  caughtSignals: SolutionEventNameEntry[];
};

export type SolutionBpmnModelEntry =
  | {
      kind: 'bpmn';
      uri: string;
      sha256: string;
      processes: SolutionProcessEntry[];
      storedLinterScores: StoredLinterScore[];
    }
  | { kind: 'invalid'; uri: string; error: string };

const SCAN_TIMEOUT_MILLISECONDS = 60_000;

type PendingScanRequest = {
  worker: Worker;
  files: BpmnModelScanFile[];
  timeoutHandle: ReturnType<typeof setTimeout>;
  resolve: (result: { entries: SolutionBpmnModelEntry[]; cacheable: boolean }) => void;
};

/** Parsed entries of unchanged files, by URI; an entry is reused while the file's SHA-256 matches. */
const scanCache = new Map<string, { sha256: string; entry: SolutionBpmnModelEntry }>();
const pendingScanRequests = new Map<number, PendingScanRequest>();
let scanWorker: Worker | null = null;
let lastRequestId = 0;

/** Fails every request in flight on `worker` and discards it; the next scan starts a fresh worker. */
function failScanWorker(worker: Worker, reason: string): void {
  worker.terminate();
  if (scanWorker === worker) {
    scanWorker = null;
  }
  for (const [requestId, pending] of pendingScanRequests) {
    if (pending.worker !== worker) {
      continue;
    }
    clearTimeout(pending.timeoutHandle);
    pendingScanRequests.delete(requestId);
    pending.resolve({
      entries: pending.files.map((file) => ({ kind: 'invalid', uri: file.uri, error: reason })),
      cacheable: false,
    });
  }
}

function getScanWorker(): Worker {
  if (scanWorker != null) {
    return scanWorker;
  }
  const worker = new Worker(new URL('./bpmn-model-scan-worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<BpmnModelScanResponse>): void => {
    const pending = pendingScanRequests.get(event.data.requestId);
    if (pending == null) {
      return;
    }
    clearTimeout(pending.timeoutHandle);
    pendingScanRequests.delete(event.data.requestId);
    pending.resolve({ entries: event.data.entries, cacheable: true });
  };
  worker.onmessageerror = (): void => failScanWorker(worker, 'The BPMN scan result could not be read.');
  worker.onerror = (event): void => failScanWorker(worker, event.message || 'The BPMN scan worker failed.');
  scanWorker = worker;
  return worker;
}

/** Parses the files in the scan worker, so a large solution does not block the window. */
function parseInWorker(files: BpmnModelScanFile[]): Promise<{ entries: SolutionBpmnModelEntry[]; cacheable: boolean }> {
  if (files.length === 0) {
    return Promise.resolve({ entries: [], cacheable: true });
  }
  return new Promise((resolve) => {
    const worker = getScanWorker();
    const requestId = ++lastRequestId;
    const timeoutHandle = setTimeout(
      () => failScanWorker(worker, `The BPMN scan did not finish within ${SCAN_TIMEOUT_MILLISECONDS / 1000} seconds.`),
      SCAN_TIMEOUT_MILLISECONDS,
    );
    pendingScanRequests.set(requestId, { worker, files, timeoutHandle, resolve });
    try {
      worker.postMessage({ requestId, files } satisfies BpmnModelScanRequest);
    } catch (error) {
      failScanWorker(worker, error instanceof Error ? error.message : String(error));
    }
  });
}

async function loadScanFile(bifrost: Bifrost, uri: string): Promise<BpmnModelScanFile | SolutionBpmnModelEntry> {
  try {
    const text = await bifrost.files.load(uri);
    return { uri, text, sha256: await sha256Hex(text) };
  } catch (error) {
    return { kind: 'invalid', uri, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Reads and parses every included `.bpmn` file of the open solution, sorted by URI. A file that cannot be read or
 * parsed becomes an `invalid` entry and does not stop the scan.
 *
 * Every call reads every file, because the solution watcher reports changes without content; only files whose
 * SHA-256 changed since the last scan are parsed again. The scan reflects saved files, not unsaved editor buffers.
 */
export async function scanSolutionBpmnModels(bifrost: Bifrost): Promise<SolutionBpmnModelEntry[]> {
  const uris = await bifrost.solution.listIncludedFileUris(/\.bpmn$/i);
  const loaded = await Promise.all(uris.map((uri) => loadScanFile(bifrost, uri)));

  const entries: SolutionBpmnModelEntry[] = [];
  const filesToParse: BpmnModelScanFile[] = [];
  for (const item of loaded) {
    if ('kind' in item) {
      entries.push(item);
      continue;
    }
    const cached = scanCache.get(item.uri);
    if (cached?.sha256 === item.sha256) {
      entries.push(cached.entry);
    } else {
      filesToParse.push(item);
    }
  }

  const parsed = await parseInWorker(filesToParse);
  if (parsed.cacheable) {
    parsed.entries.forEach((entry, index) => scanCache.set(entry.uri, { sha256: filesToParse[index].sha256, entry }));
  }
  const listedUris = new Set(uris);
  for (const uri of scanCache.keys()) {
    if (!listedUris.has(uri)) {
      scanCache.delete(uri);
    }
  }

  return [...entries, ...parsed.entries].sort((first, second) => first.uri.localeCompare(second.uri));
}
