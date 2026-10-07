import {
  NO_LINTER_SCORE_INFO,
  analyzeDeployPlan,
  collectReferencedIds,
  getDeployBlockedReason,
} from '#modules/engine-deploy/analysis/analyzeDeployPlan';
import type { SolutionModelEntry } from '#modules/engine-deploy/analysis/scanSolutionModels';
import type { DeployConnection, EngineSnapshot } from '#modules/engine-deploy/analysis/types';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

import { scanDeployFixture } from './support/fixtureEntries';

const fixtureDirectory = path.resolve(__dirname, '../../fixtures/test-solution-deploy');
const baseUri = pathToFileURL(fixtureDirectory).href;
const uriOf = (file: string): string => `${baseUri}/${file}`;

const online: DeployConnection = { engineId: 'e1', connected: true, canDeployBpmn: true, canDeployDmn: true };
const healthy = { ok: true, message: null };

let entries: SolutionModelEntry[];
const entryOf = (file: string): SolutionModelEntry =>
  entries.find((entry) => entry.uri === uriOf(file)) as SolutionModelEntry;
const shaOf = (file: string): string => (entryOf(file) as { sha256: string }).sha256;

function analyze(planFiles: string[], snapshot: EngineSnapshot | null, overrides: object = {}) {
  return analyzeDeployPlan({
    planUris: planFiles.map(uriOf),
    entries,
    snapshot,
    connection: online,
    unsavedUris: new Set(),
    ...overrides,
  });
}
const itemOf = (analysis: ReturnType<typeof analyze>, file: string) =>
  analysis.items.find((item) => item.uri === uriOf(file)) as ReturnType<typeof analyze>['items'][number];

beforeAll(async () => {
  entries = await scanDeployFixture();
});

describe('analyzeDeployPlan statuses', () => {
  it('reports a process the Engine does not know as new', () => {
    const analysis = analyze(['order-process.bpmn'], { health: healthy, processes: {}, decisions: {} });
    expect(itemOf(analysis, 'order-process.bpmn').status).toBe('new');
  });

  it('reports a version that is not deployed as newVersion', () => {
    const snapshot = {
      health: healthy,
      processes: { 'order-process': [{ version: '0.9.0', sha256: 'x' }] },
      decisions: {},
    };
    expect(itemOf(analyze(['order-process.bpmn'], snapshot), 'order-process.bpmn').status).toBe('newVersion');
  });

  it('reports an identical deployed version as unchanged and leaves it out by default', () => {
    const snapshot = {
      health: healthy,
      processes: { 'order-process': [{ version: '1.0.0', sha256: shaOf('order-process.bpmn') }] },
      decisions: {},
    };
    const item = itemOf(analyze(['order-process.bpmn'], snapshot), 'order-process.bpmn');
    expect(item.status).toBe('unchanged');
    expect(item.includedByDefault).toBe(false);
  });

  it('reports a deployed version with a different hash as changedWithoutVersionBump', () => {
    const snapshot = {
      health: healthy,
      processes: { 'order-process': [{ version: '1.0.0', sha256: 'other' }] },
      decisions: {},
    };
    const item = itemOf(analyze(['order-process.bpmn'], snapshot), 'order-process.bpmn');
    expect(item.status).toBe('changedWithoutVersionBump');
    expect(item.includedByDefault).toBe(true);
  });

  it('reports a missing bfw:version as versionMissing, even offline', () => {
    const item = itemOf(analyze(['unversioned-process.bpmn'], null), 'unversioned-process.bpmn');
    expect(item.status).toBe('versionMissing');
  });

  it('lists a non-executable process as skipped and does not include it', () => {
    const item = itemOf(
      analyze(['draft-process.bpmn'], { health: healthy, processes: {}, decisions: {} }),
      'draft-process.bpmn',
    );
    expect(item.status).toBe('skipped');
    expect(item.processes[0].status).toBe('skipped');
    expect(item.includedByDefault).toBe(false);
  });

  it('reports unknown without an Engine snapshot', () => {
    expect(itemOf(analyze(['order-process.bpmn'], null), 'order-process.bpmn').status).toBe('unknown');
  });

  it('classifies DMN files by the first 12 hex characters of the hash', () => {
    const decisions = (versions: string[]): EngineSnapshot => ({
      health: healthy,
      processes: {},
      decisions: versions.length === 0 ? {} : { 'discount-rules': versions },
    });
    const statusFor = (snapshot: EngineSnapshot) =>
      itemOf(analyze(['discount-rules.dmn'], snapshot), 'discount-rules.dmn').status;

    expect(statusFor(decisions([]))).toBe('new');
    expect(statusFor(decisions(['abcdef123456']))).toBe('newVersion');
    expect(statusFor(decisions([shaOf('discount-rules.dmn').slice(0, 12)]))).toBe('unchanged');
  });
});

describe('analyzeDeployPlan dependencies', () => {
  const emptySnapshot: EngineSnapshot = { health: healthy, processes: {}, decisions: {} };
  const stateOf = (analysis: ReturnType<typeof analyze>, id: string, version: string | null = null) =>
    analysis.dependencies.find((dependency) => dependency.id === id && dependency.version === version)?.state;

  it('resolves the four dependency states for order-process', () => {
    const analysis = analyze(['order-process.bpmn'], emptySnapshot);

    expect(stateOf(analysis, 'payment-process')).toBe('localNotInPlan');
    expect(stateOf(analysis, 'payment-process', '1.0.0')).toBe('localNotInPlan');
    expect(stateOf(analysis, 'discount-rules')).toBe('localNotInPlan');
    expect(stateOf(analysis, 'archive-process')).toBe('missing');

    const withPlan = analyze(['order-process.bpmn', 'payment-process.bpmn', 'discount-rules.dmn'], emptySnapshot);
    expect(stateOf(withPlan, 'payment-process')).toBe('inPlan');
    expect(stateOf(withPlan, 'discount-rules')).toBe('inPlan');

    const onEngine = analyze(['order-process.bpmn'], {
      health: healthy,
      processes: { 'payment-process': [{ version: '1.0.0', sha256: null }] },
      decisions: { 'discount-rules': ['abc'] },
    });
    expect(stateOf(onEngine, 'payment-process')).toBe('onEngine');
    expect(stateOf(onEngine, 'payment-process', '1.0.0')).toBe('onEngine');
    expect(stateOf(onEngine, 'discount-rules')).toBe('onEngine');
  });

  it('does not accept another version for a pinned call activity', () => {
    const analysis = analyze(['order-process.bpmn'], {
      health: healthy,
      processes: { 'payment-process': [{ version: '2.0.0', sha256: null }] },
      decisions: {},
    });
    expect(stateOf(analysis, 'payment-process')).toBe('onEngine');
    expect(stateOf(analysis, 'payment-process', '1.0.0')).toBe('localNotInPlan');
  });

  it('records which files require a dependency', () => {
    const dependency = analyze(['order-process.bpmn'], emptySnapshot).dependencies.find(
      (candidate) => candidate.id === 'archive-process',
    );
    expect(dependency?.requiredBy).toEqual([uriOf('order-process.bpmn')]);
    expect(dependency?.fileUri).toBeNull();
  });

  it('marks unresolved references unknown while the Engine is offline', () => {
    expect(stateOf(analyze(['order-process.bpmn'], null), 'archive-process')).toBe('unknown');
  });

  it('collects the ids of the plan and its transitive local closure', () => {
    const { processIds, decisionIds } = collectReferencedIds([uriOf('order-process.bpmn')], entries);
    expect([...processIds].sort()).toEqual(['archive-process', 'order-process', 'payment-process']);
    expect([...decisionIds]).toEqual(['discount-rules']);
  });
});

describe('analyzeDeployPlan blockers', () => {
  const snapshot: EngineSnapshot = { health: healthy, processes: {}, decisions: {} };

  it('blocks when no Engine is selected, when it is offline and when its health check fails', () => {
    const noEngine = analyze(['order-process.bpmn'], null, {
      connection: { ...online, engineId: null, connected: false },
    });
    expect(noEngine.globalBlockers).toEqual(['No Engine is selected.']);

    const offline = analyze(['order-process.bpmn'], null, { connection: { ...online, connected: false } });
    expect(offline.globalBlockers).toEqual(['No connected Engine.']);

    const unhealthy = analyze(['order-process.bpmn'], null, { engineUnavailableMessage: 'boom' });
    expect(unhealthy.globalBlockers).toEqual(['Engine is not reachable: boom']);
    expect(itemOf(unhealthy, 'order-process.bpmn').status).toBe('unknown');
  });

  it('blocks a file with unsaved editor changes', () => {
    const analysis = analyze(['order-process.bpmn'], snapshot, { unsavedUris: new Set([uriOf('order-process.bpmn')]) });
    expect(itemOf(analysis, 'order-process.bpmn').blockers).toEqual([
      'Unsaved changes in the editor; save the file first.',
    ]);
  });

  it('blocks a file that is not readable or not in the solution', () => {
    const invalid: SolutionModelEntry = { kind: 'invalid', uri: uriOf('broken.bpmn'), error: 'bad xml' };
    const analysis = analyze(['broken.bpmn', 'ghost.bpmn'], snapshot, { entries: [...entries, invalid] });
    expect(itemOf(analysis, 'broken.bpmn').blockers).toEqual(['Cannot read the file: bad xml']);
    expect(itemOf(analysis, 'ghost.bpmn').blockers).toEqual(['The file is not part of the solution.']);
    expect(itemOf(analysis, 'broken.bpmn').includedByDefault).toBe(false);
  });

  it('blocks files whose deploy capability is missing', () => {
    const analysis = analyze(['order-process.bpmn', 'discount-rules.dmn'], snapshot, {
      connection: { ...online, canDeployBpmn: false, canDeployDmn: false },
    });
    expect(itemOf(analysis, 'order-process.bpmn').blockers).toEqual(['The token lacks the deploy_bpmn permission.']);
    expect(itemOf(analysis, 'discount-rules.dmn').blockers).toEqual(['The token lacks the deploy_dmn permission.']);
  });

  it('only counts blockers of included items in the Deploy reason', () => {
    const analysis = analyze(['order-process.bpmn', 'payment-process.bpmn'], snapshot, {
      unsavedUris: new Set([uriOf('order-process.bpmn')]),
    });

    expect(getDeployBlockedReason(analysis, new Set([uriOf('payment-process.bpmn')]))).toBeNull();
    expect(getDeployBlockedReason(analysis, new Set([uriOf('order-process.bpmn')]))).toContain('order-process.bpmn');
    expect(getDeployBlockedReason(analysis, new Set())).toBe('No files are selected for deployment.');
  });

  it('prefixes reasons with the folder so equal file names stay distinguishable', () => {
    const analysis = analyze(['order-process.bpmn'], snapshot, { unsavedUris: new Set([uriOf('order-process.bpmn')]) });
    const reason = getDeployBlockedReason(analysis, new Set([uriOf('order-process.bpmn')]), [
      { name: 'fixture', baseUri },
      { name: 'other', baseUri: 'file:///elsewhere' },
    ]);
    expect(reason).toBe('fixture/order-process.bpmn: Unsaved changes in the editor; save the file first.');
  });

  it('puts global blockers first in the Deploy reason', () => {
    const analysis = analyze(['order-process.bpmn'], null, { connection: { ...online, connected: false } });
    expect(getDeployBlockedReason(analysis, new Set([uriOf('order-process.bpmn')]))).toBe('No connected Engine.');
  });
});

describe('analyzeDeployPlan linter scores', () => {
  it('shows the stored scores of order-process and the info line for payment-process', () => {
    const analysis = analyze(['order-process.bpmn', 'payment-process.bpmn'], null);
    expect(itemOf(analysis, 'order-process.bpmn').storedLinterScores).toHaveLength(2);
    expect(itemOf(analysis, 'order-process.bpmn').linterInfo).toBeNull();
    expect(itemOf(analysis, 'payment-process.bpmn').linterInfo).toBe(NO_LINTER_SCORE_INFO);
  });

  it('does not show the info line for DMN files or skipped processes', () => {
    const analysis = analyze(['discount-rules.dmn', 'draft-process.bpmn'], null);
    expect(itemOf(analysis, 'discount-rules.dmn').linterInfo).toBeNull();
    expect(itemOf(analysis, 'draft-process.bpmn').linterInfo).toBeNull();
  });
});
