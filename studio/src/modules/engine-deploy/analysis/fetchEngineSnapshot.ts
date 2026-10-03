import { sha256Hex } from '#modules/solution-models/scanSolutionModels';

import type { EngineSnapshot } from './types';

/** The part of `BfwEngineClient` the snapshot needs. */
export type SnapshotClient = {
  engine: { health(): Promise<unknown> };
  processes: {
    getAll(): Promise<{ id: string }[]>;
    getVersions(id: string, options: { includeXml: true }): Promise<{ version?: string; bpmnXml?: string }[]>;
  };
  decisions: {
    getAll(): Promise<{ id: string }[]>;
    getVersions(id: string, options: { includeXml: true }): Promise<{ version?: string }[]>;
  };
};

/**
 * Reads the deployed versions of the given process and decision ids. Ids the Engine does not know are left out, so a
 * missing key means "not deployed". Any failure becomes `health.ok = false` with the message.
 *
 * ponytail: one `getVersions` request per known id (with XML). The upgrade path is a bulk endpoint.
 */
export async function fetchEngineSnapshot(
  client: SnapshotClient,
  processIds: Iterable<string>,
  decisionIds: Iterable<string>,
): Promise<EngineSnapshot> {
  const snapshot: EngineSnapshot = { health: { ok: true, message: null }, processes: {}, decisions: {} };
  try {
    await client.engine.health();
    const [knownProcesses, knownDecisions] = await Promise.all([client.processes.getAll(), client.decisions.getAll()]);
    const knownProcessIds = new Set(knownProcesses.map((process) => process.id));
    const knownDecisionIds = new Set(knownDecisions.map((decision) => decision.id));

    await Promise.all([
      ...[...new Set(processIds)]
        .filter((id) => knownProcessIds.has(id))
        .map(async (id) => {
          const versions = await client.processes.getVersions(id, { includeXml: true });
          snapshot.processes[id] = await Promise.all(
            versions
              .filter((entry) => entry.version != null)
              .map(async (entry) => ({
                version: entry.version as string,
                sha256: entry.bpmnXml == null ? null : await sha256Hex(entry.bpmnXml),
              })),
          );
        }),
      ...[...new Set(decisionIds)]
        .filter((id) => knownDecisionIds.has(id))
        .map(async (id) => {
          const versions = await client.decisions.getVersions(id, { includeXml: true });
          snapshot.decisions[id] = versions.flatMap((entry) => (entry.version == null ? [] : [entry.version]));
        }),
    ]);
  } catch (error) {
    return {
      health: { ok: false, message: error instanceof Error ? error.message : String(error) },
      processes: {},
      decisions: {},
    };
  }
  return snapshot;
}
