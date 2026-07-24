import type { Bifrost } from '#bifrost/Bifrost';

import { dmnModelerModuleRegistry } from './DmnModelerModuleRegistry';
import PluginDmnContextPadProviderModule from './dmn-js/Provider/PluginDmnContextPadProvider';
import PluginDmnPaletteProviderModule from './dmn-js/Provider/PluginDmnPaletteProvider';
import './sanitizer/sanitizer.scss';

export { DmnValidator } from './validation/DmnValidator';
export type { DmnViolation, DmnValidationSeverity } from './validation/DmnValidator';

export {
  DmnDiff,
  DmnViewerWithSync,
  buildDmnChangeSummary,
  dmnChangeSummaryHasAnyChange,
  formatDmnChangeSummaryAsMarkdown,
  formatDmnType,
  createDmnModdleForDiff,
  parseDmnDefinitionsFromXml,
} from './diff';
export type {
  DmnDiffChange,
  DmnDiffChangesByAction,
  DmnDiffChangesById,
  DmnAttributeChange,
  DmnChangeSummary,
  DmnChangeSummaryEntry,
  DmnModifiedEntry,
  DmnRawDiffResult,
} from './diff';

export function onLoad(bifrost: Bifrost): void {
  bifrost.commands.register('dmn.modeler.registerModule', (module: any) => {
    dmnModelerModuleRegistry.register(module);
  });

  dmnModelerModuleRegistry.register(PluginDmnPaletteProviderModule);
  dmnModelerModuleRegistry.register(PluginDmnContextPadProviderModule);
}
