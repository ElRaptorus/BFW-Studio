import type { Bifrost } from '#bifrost/Bifrost';
import type { MenuBarItemMap } from '#bifrost/contracts/MenuBarTypes';
import type BpmnDocumentModel from '#modules/bpmn-editor/BpmnDocumentModel';

import type { LintBridgeApi } from '../types';

export function initializeMenuBarItems(bifrost: Bifrost): void {
  bifrost.menuBar.registerMenuBarItemModifier((menuBarItems: MenuBarItemMap) => {
    const doc = bifrost.editors.getFocusedEditorDocument();
    const isBpmn = doc?.documentType === 'bpmn';
    const linterEnabled = bifrost.settings.get('bpmnLinter.enabled') === true;

    if (!isBpmn || !linterEnabled) {
      return menuBarItems;
    }

    const model = bifrost.editors.getEditorDocumentModelIfPresent<BpmnDocumentModel>(doc);
    const bridge = model?.modelerAdapter?.getModelerComponentByName<LintBridgeApi>('lintBridge');
    const profiles = bridge?.getAvailableProfiles() ?? [];
    const activeProfile = bridge?.getActiveProfile() ?? 'bpmn-development';

    const entries = profiles.map((profile: { id: string; label: string }) => ({
      value: profile.id,
      label: profile.label,
    }));

    if (entries.length === 0) {
      return menuBarItems;
    }

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
