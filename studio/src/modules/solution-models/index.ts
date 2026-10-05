import type { Bifrost } from '#bifrost/Bifrost';

import { scanSolutionModels } from './scanSolutionModels';
import type { SolutionModelEntry } from './types';

export async function onLoad(bifrost: Bifrost): Promise<void> {
  const scan = async (): Promise<SolutionModelEntry[]> => {
    const solution = bifrost.solution.getSolution();
    return solution == null ? [] : scanSolutionModels(solution, bifrost.files);
  };

  bifrost.commands.register('solution.models.scan', scan);

  bifrost.commands.register('solution.models.findProcessFile', async (processId: string): Promise<string | null> => {
    const entries = await scan();
    const match = entries.find(
      (entry) => entry.kind === 'bpmn' && entry.processes.some((process) => process.id === processId),
    );
    return match?.uri ?? null;
  });

  bifrost.commands.register(
    'solution.models.findDecisionFile',
    async (definitionsId: string): Promise<string | null> => {
      const entries = await scan();
      const match = entries.find((entry) => entry.kind === 'dmn' && entry.definitionsId === definitionsId);
      return match?.uri ?? null;
    },
  );

  bifrost.commands.register(
    'solution.models.findDecisionModelByNamespace',
    async (namespace: string): Promise<Extract<SolutionModelEntry, { kind: 'dmn' }> | null> => {
      const entries = await scan();
      const match = entries.find((entry) => entry.kind === 'dmn' && entry.namespace === namespace);
      return match?.kind === 'dmn' ? match : null;
    },
  );
}
