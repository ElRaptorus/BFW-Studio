import type { Bifrost } from '#bifrost/Bifrost';
import type { MenuBarItem } from '#bifrost/contracts/MenuBarTypes';

import type { CustomRulesetEntry } from '../types';

export function listLinterProfileEntries(
  profileName: string | undefined,
  customRulesets: Record<string, CustomRulesetEntry>,
): { entries: { value: string; label: string }[]; activeProfile: string } {
  const builtIn = [
    { value: 'bpmn-development', label: 'Development' },
    { value: 'bpmn-production-ready', label: 'Production Ready' },
  ];
  const custom = Object.keys(customRulesets).map((name) => ({
    value: name,
    label: name,
  }));
  const entries = [...builtIn, ...custom];
  const activeProfile =
    profileName && entries.some((entry) => entry.value === profileName) ? profileName : 'bpmn-development';
  return { entries, activeProfile };
}

export function profileOriginSuffix(bifrost: Bifrost): string {
  const definedIn = bifrost.settings.inspect('bpmnLinter.profile').definedIn;
  if (definedIn === 'solution') {
    return ' (Solution)';
  }
  if (definedIn === 'project') {
    const focusedUri = bifrost.editors.getFocusedEditorDocument()?.uri ?? null;
    const projectBaseUri = bifrost.settings.getProjectBaseUriForResource(focusedUri);
    const project = bifrost.solution.getSolution()?.projects.find((candidate) => candidate.baseUri === projectBaseUri);
    return ` (Project: ${project?.name ?? 'Project'})`;
  }
  return '';
}

/** The ruleset icon and select, shown while a BPMN document is focused — whether or not live linting is on. */
export function buildLinterPageBarItems(bifrost: Bifrost): MenuBarItem[] {
  if (bifrost.editors.getFocusedEditorDocument()?.documentType !== 'bpmn') {
    return [];
  }
  const profileName = bifrost.settings.get('bpmnLinter.profile') as string | undefined;
  const customRulesets =
    (bifrost.settings.get('bpmnLinter.customRulesets') as Record<string, CustomRulesetEntry> | undefined) ?? {};
  const { entries, activeProfile } = listLinterProfileEntries(profileName, customRulesets);
  const originSuffix = profileOriginSuffix(bifrost);

  return [
    {
      type: 'icon',
      id: 'bpmn-linter-rule-selection-icon',
      icon: 'ph ph-fill ph-highlighter',
      tooltip: `Current Linter Ruleset${originSuffix}`,
    },
    {
      type: 'select',
      id: 'bpmn-linter-profile-select',
      command: 'bpmn.linter.setProfile',
      entries,
      value: activeProfile,
      tooltip: `Select Linter Ruleset${originSuffix}`,
    },
  ];
}

export function initializePageBarItems(bifrost: Bifrost): void {
  bifrost.menuBar.registerMenuBarItem('pageBar', () => buildLinterPageBarItems(bifrost), { pages: ['design/*'] });
}
