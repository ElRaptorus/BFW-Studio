import type { Bifrost } from '#bifrost/Bifrost';
import type { MenuBarItemMap } from '#bifrost/contracts/MenuBarTypes';

import type { CustomRulesetEntry } from '../types';

function listLinterProfileEntries(
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

export function initializeMenuBarItems(bifrost: Bifrost): void {
  bifrost.menuBar.registerMenuBarItemModifier((menuBarItems: MenuBarItemMap) => {
    const profileName = bifrost.settings.get('bpmnLinter.profile') as string | undefined;
    const customRulesets =
      (bifrost.settings.get('bpmnLinter.customRulesets') as Record<string, CustomRulesetEntry> | undefined) ?? {};
    const { entries, activeProfile } = listLinterProfileEntries(profileName, customRulesets);

    return bifrost.menuBar.insertBeforeMenuBarItem(menuBarItems, 'menu-bar-menu-layout', () => [
      {
        type: 'icon',
        id: 'bpmn-linter-rule-selection-icon',
        icon: 'ph ph-fill ph-highlighter',
        tooltip: 'Current Linter Ruleset',
      },
      {
        type: 'select',
        id: 'bpmn-linter-profile-select',
        command: 'bpmn.linter.setProfile',
        entries,
        value: activeProfile,
        tooltip: 'Select Linter Ruleset',
      },
    ]);
  });
}
