import type { Bifrost } from '#bifrost/Bifrost';
import type { SolutionBpmnModelEntry } from '#modules/bpmn-core/scanSolutionBpmnModels';
import { scanSolutionBpmnModels } from '#modules/bpmn-core/scanSolutionBpmnModels';
import type { SolutionDmnModelEntry } from '#modules/dmn-core/scanSolutionDmnModels';
import { scanSolutionDmnModels } from '#modules/dmn-core/scanSolutionDmnModels';

export type SolutionModelEntry = SolutionBpmnModelEntry | SolutionDmnModelEntry;

/**
 * BPMN and DMN files of the open solution, sorted by URI.
 *
 * ponytail: each scanner lists and reads its own extension, so a deploy scan walks the solution twice.
 * Fine while a solution is hundreds of files. The upgrade path is one traversal that splits by extension.
 */
export async function scanSolutionModels(bifrost: Bifrost): Promise<SolutionModelEntry[]> {
  const [bpmnEntries, dmnEntries] = await Promise.all([
    scanSolutionBpmnModels(bifrost),
    scanSolutionDmnModels(bifrost),
  ]);
  return [...bpmnEntries, ...dmnEntries].sort((first, second) => first.uri.localeCompare(second.uri));
}
