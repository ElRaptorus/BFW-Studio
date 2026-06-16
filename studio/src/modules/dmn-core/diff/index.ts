export { DmnDiff, type DmnDiffChange, type DmnDiffChangesByAction, type DmnDiffChangesById } from './DmnDiff';
export { DmnViewerWithSync } from './DmnViewerWithSync';
export {
  buildDmnChangeSummary,
  dmnChangeSummaryHasAnyChange,
  formatDmnChangeSummaryAsMarkdown,
  formatDmnType,
  resolveAttributeLabel,
  type DmnAttributeChange,
  type DmnChangeSummary,
  type DmnChangeSummaryEntry,
  type DmnModifiedEntry,
  type DmnRawDiffResult,
} from './changeSummaryBuilder';
export { createDmnModdleForDiff, parseDmnDefinitionsFromXml } from './dmnModdleForDiff';
