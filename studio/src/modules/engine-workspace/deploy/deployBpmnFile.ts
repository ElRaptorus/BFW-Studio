import type { Bifrost } from '#bifrost/Bifrost';
import { ENGINE_COMMANDS, formatDeployErrorMessage } from '#modules/engine-core';
import * as fs from 'fs/promises';
import * as path from 'path';

const MAXIMUM_CONFLICT_RETRIES = 3;

export type BpmnFileDeployOptions = {
  allowRunExistingOnConflict?: boolean;
};

export type BpmnFileDeployOutcome =
  | {
      status: 'deployed';
      /** First deployed (or, for "run existing", chosen) process; null when the Engine named none. */
      processModelId: string;
      processModelIds: string[];
      engineId: string;
      filePath: string;
      fileName: string;
    }
  /** The user closed a dialog (version prompt or conflict resolution). */
  | { status: 'cancelled' }
  | { status: 'failed'; message: string; error?: unknown };

/**
 * Shared BPMN deploy pipeline: read the file, ensure versions, deploy with a version-conflict retry loop. Rewritten
 * files (new versions) are saved to disk. Never opens notifications; the caller reports the outcome.
 */
export async function deployBpmnFile(
  bifrost: Bifrost,
  engineId: string,
  filePath: string,
  options?: BpmnFileDeployOptions,
): Promise<BpmnFileDeployOutcome> {
  const fileName = path.basename(filePath);
  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    return { status: 'failed', message: `Cannot read "${fileName}": ${(error as Error).message}`, error };
  }

  const checked = await bifrost.commands.executeCommand(ENGINE_COMMANDS.ensureProcessVersions, [engineId, content]);
  if (checked == null) {
    return { status: 'cancelled' };
  }
  if (checked.modified) {
    await fs.writeFile(filePath, checked.xml, 'utf-8');
  }
  content = checked.xml;

  for (let attempt = 0; attempt <= MAXIMUM_CONFLICT_RETRIES; attempt++) {
    try {
      const result: any = await bifrost.commands.executeCommand(ENGINE_COMMANDS.deploy, [engineId, content, fileName]);
      const processModelIds: string[] = (result?.deployed ?? [])
        .map((deployed: any) => deployed?.processModelId)
        .filter((id: unknown): id is string => typeof id === 'string');
      if (processModelIds.length === 0) {
        return { status: 'failed', message: 'Deploy succeeded but the engine did not return a process model ID.' };
      }
      return { status: 'deployed', processModelId: processModelIds[0], processModelIds, engineId, filePath, fileName };
    } catch (deployError: any) {
      if (deployError?.errorCode === 'version_exists' && Array.isArray(deployError?.conflicts)) {
        const resolved = await bifrost.commands.executeCommand(ENGINE_COMMANDS.resolveVersionConflicts, [
          engineId,
          content,
          deployError.conflicts,
          { allowRunExisting: options?.allowRunExistingOnConflict },
        ]);
        if (resolved == null) {
          return { status: 'cancelled' };
        }
        if ('runExisting' in resolved) {
          return {
            status: 'deployed',
            processModelId: resolved.processModelId,
            processModelIds: [resolved.processModelId],
            engineId,
            filePath,
            fileName,
          };
        }
        await fs.writeFile(filePath, resolved.xml, 'utf-8');
        content = resolved.xml;
        continue;
      }
      return { status: 'failed', message: formatDeployErrorMessage(deployError), error: deployError };
    }
  }

  return { status: 'failed', message: 'Deployment failed after multiple version-conflict retries.' };
}
