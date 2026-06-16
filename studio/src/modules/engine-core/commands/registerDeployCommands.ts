import type { Bifrost } from '#bifrost/Bifrost';

import type { EngineConnectionManager } from '../EngineConnectionManager';

const DEPLOY_BATCH_SIZE = 5;

function splitIntoChunks<T>(array: T[], size: number): T[][] {
  if (array.length === 0) {
    return [];
  }
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export type DeployFailureDetail = {
  fileName: string;
  details: string[];
};

function remapFailuresToFileNames(error: any, chunkFileNames: string[]): DeployFailureDetail[] | null {
  const rawFailures: any[] | undefined = error?.rawBody?.failures;
  if (!Array.isArray(rawFailures) || rawFailures.length === 0) {
    return null;
  }

  return rawFailures.map((failure: any) => {
    const syntheticFile: string = failure?.file ?? '';
    const indexMatch = syntheticFile.match(/^source_(\d+)\./);
    const oneBasedIndex = indexMatch ? parseInt(indexMatch[1], 10) : 0;
    const realFileName =
      oneBasedIndex > 0 && oneBasedIndex <= chunkFileNames.length ? chunkFileNames[oneBasedIndex - 1] : syntheticFile;

    const details: string[] = Array.isArray(failure?.details) ? failure.details : [];
    return { fileName: realFileName, details };
  });
}

function enrichDeployError(error: any, fileNames: string[], failureDetails: DeployFailureDetail[] | null): any {
  error._deployFileNames = fileNames;
  if (failureDetails != null) {
    error._deployFailures = failureDetails;
  }
  return error;
}

export function formatDeployErrorMessage(error: any): string {
  const failures: DeployFailureDetail[] | undefined = error?._deployFailures;
  const fileNames: string[] | undefined = error?._deployFileNames;
  const rawMessage: string = error?.message ?? String(error);
  const statusCode: number | undefined = error?.statusCode;

  if (statusCode === 403 || rawMessage.toLowerCase().includes('permission')) {
    return 'Deploy failed: Insufficient permissions. Check your JWT token claims (deploy_bpmn / deploy_dmn).';
  }

  const lines: string[] = [];

  if (failures != null && failures.length > 0) {
    for (const failure of failures) {
      if (failure.details.length > 0) {
        lines.push(`${failure.fileName}: ${failure.details.join('; ')}`);
      } else {
        lines.push(failure.fileName);
      }
    }
    return `Deploy failed:\n${lines.join('\n')}`;
  }

  if (fileNames != null && fileNames.length === 1) {
    return `Deploy of "${fileNames[0]}" failed: ${rawMessage}`;
  }

  if (fileNames != null && fileNames.length > 1) {
    return `Deploy failed (${fileNames.join(', ')}): ${rawMessage}`;
  }

  return `Deploy failed: ${rawMessage}`;
}

export default function registerDeployCommands(bifrost: Bifrost, connectionManager: EngineConnectionManager): void {
  bifrost.commands.register(
    'engine.deploy',
    async (engineId: string, fileContent: string, fileName: string) => {
      const connection = connectionManager.getConnection(engineId);
      if (!connection) {
        throw new Error(`Engine ${engineId} not connected`);
      }

      connectionManager.setLastDeployTargetUrl(connection.url);

      try {
        const isDmn = fileName.toLowerCase().endsWith('.dmn');
        if (isDmn) {
          return await connection.client.decisions.deploy(fileContent);
        }
        return await connection.client.processes.deploy(fileContent);
      } catch (error: any) {
        const failures = remapFailuresToFileNames(error, [fileName]);
        throw enrichDeployError(error, [fileName], failures);
      }
    },
    { enabledWhen: (engineId: string) => connectionManager.isConnected(engineId) },
  );

  bifrost.commands.register(
    'engine.deployBatch',
    async (engineId: string, files: { content: string; name: string }[]) => {
      const connection = connectionManager.getConnection(engineId);
      if (!connection) {
        throw new Error(`Engine ${engineId} not connected`);
      }

      connectionManager.setLastDeployTargetUrl(connection.url);

      const bpmnFiles: { content: string; name: string }[] = [];
      const dmnFiles: { content: string; name: string }[] = [];

      for (const file of files) {
        if (file.name.toLowerCase().endsWith('.dmn')) {
          dmnFiles.push(file);
        } else {
          bpmnFiles.push(file);
        }
      }

      const results: unknown[] = [];

      for (const chunk of splitIntoChunks(bpmnFiles, DEPLOY_BATCH_SIZE)) {
        const chunkNames = chunk.map((file) => file.name);
        try {
          results.push(await connection.client.processes.deploy(chunk.map((file) => file.content)));
        } catch (error: any) {
          const failures = remapFailuresToFileNames(error, chunkNames);
          throw enrichDeployError(error, chunkNames, failures);
        }
      }

      for (const chunk of splitIntoChunks(dmnFiles, DEPLOY_BATCH_SIZE)) {
        const chunkNames = chunk.map((file) => file.name);
        try {
          results.push(await connection.client.decisions.deploy(chunk.map((file) => file.content)));
        } catch (error: any) {
          const failures = remapFailuresToFileNames(error, chunkNames);
          throw enrichDeployError(error, chunkNames, failures);
        }
      }

      return results;
    },
    { enabledWhen: (engineId: string) => connectionManager.isConnected(engineId) },
  );
}
