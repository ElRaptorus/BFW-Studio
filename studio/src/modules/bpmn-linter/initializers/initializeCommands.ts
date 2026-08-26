import type { Bifrost } from '#bifrost/Bifrost';
import type { DialogResult } from '#bifrost/contracts/DialogTypes';
import type BpmnDocumentModel from '#modules/bpmn-editor/BpmnDocumentModel';

import { profiles } from '../rules/config';
import type { CustomRulesetEntry, LintBridgeApi } from '../types';

function getLintBridge(bifrost: Bifrost): LintBridgeApi | null {
  const doc = bifrost.editors.getFocusedEditorDocument();
  if (!doc || doc.documentType !== 'bpmn') {
    return null;
  }

  const model = bifrost.editors.getEditorDocumentModelIfPresent<BpmnDocumentModel>(doc);
  return model?.modelerAdapter?.getModelerComponentByName<LintBridgeApi>('lintBridge') ?? null;
}

function deriveDefaultFilename(documentUri: string): string {
  const segments = documentUri.split('/');
  const basename = segments[segments.length - 1] ?? 'diagram';
  return basename.replace(/\.bpmn$/i, '') + '-lint-report.json';
}

export function initializeCommands(bifrost: Bifrost): void {
  const isBpmnFocused = () => bifrost.editors.getFocusedEditorDocument()?.documentType === 'bpmn';

  bifrost.commands.register('bpmn.linter.toggle', () => getLintBridge(bifrost)?.toggle(), {
    enabledWhen: isBpmnFocused,
  });

  bifrost.commands.register(
    'bpmn.linter.showProblemsPane',
    () => {
      bifrost.panes.setActiveGroupInArea('right', 'linter');
      bifrost.panes.showPaneArea('right');
    },
    { enabledWhen: isBpmnFocused },
  );

  bifrost.commands.register(
    'bpmn.linter.setProfile',
    (profile: string) => {
      bifrost.settings.set('bpmnLinter.profile', profile);
    },
    { enabledWhen: isBpmnFocused },
  );

  bifrost.commands.register(
    'bpmn.linter.createCustomRuleset',
    async () => {
      const result = await bifrost.dialog.open(
        {
          title: 'Create Custom Ruleset',
          content: [
            {
              type: 'text_input',
              id: 'rulesetName',
              label: 'Ruleset Name',
              placeholder: 'e.g. My Strict Rules',
              focus: true,
            },
            {
              type: 'select',
              id: 'template',
              label: 'Based on',
              value: 'bpmn-development',
              entries: [
                { label: 'Development', value: 'bpmn-development' },
                { label: 'Production Ready', value: 'bpmn-production-ready' },
              ],
            },
            {
              type: 'checkbox',
              id: 'copyRules',
              label: 'Copy rules from template',
              checked: true,
            },
          ],
          actions: [
            { label: 'Cancel', response: 'cancel', cancel: true },
            { label: 'Create', response: 'create', default: true },
          ],
        },
        async (dialogResult: DialogResult) => {
          if (dialogResult.response !== 'create') {
            return { closeDialog: true };
          }
          const name = (dialogResult.formData?.rulesetName as string | undefined)?.trim();
          if (!name) {
            return {
              closeDialog: false,
              validationErrors: [{ contentId: 'rulesetName', errorLabel: 'Name cannot be empty' }],
            };
          }
          const existing =
            (bifrost.settings.get('bpmnLinter.customRulesets') as Record<string, CustomRulesetEntry> | undefined) ?? {};
          if (name in existing) {
            return {
              closeDialog: false,
              validationErrors: [{ contentId: 'rulesetName', errorLabel: 'A ruleset with this name already exists' }],
            };
          }
          return { closeDialog: true };
        },
      );

      if (result?.wasCancelled || result?.response !== 'create') {
        return;
      }

      const name = (result.formData?.rulesetName as string | undefined)?.trim();
      const template = (result.formData?.template as string | undefined) ?? 'bpmn-development';
      const copyRules = (result.formData?.copyRules as boolean | undefined) ?? true;
      if (!name) {
        return;
      }

      const rulesetEntry: CustomRulesetEntry = {
        base: template,
        rules: copyRules ? { ...profiles[template]?.rules } : {},
      };
      bifrost.settings.add('bpmnLinter.customRulesets', {
        [name]: rulesetEntry,
      });

      bifrost.settings.set('bpmnLinter.profile', name);
      bifrost.commands.executeCommand('std.settings.openUserSettingsJson');
    },
    {
      visibleInSearch: true,
      description: 'BPMN: Create Custom Lint Ruleset',
    },
  );

  bifrost.commands.register(
    'bpmn.linter.exportFindings',
    async () => {
      const bridge = getLintBridge(bifrost);
      if (!bridge || !bridge.isActive()) {
        return;
      }

      const findings = bridge.getFindings();
      if (findings.length === 0) {
        return;
      }

      const doc = bifrost.editors.getFocusedEditorDocument();
      const counts = bridge.getCounts();

      const report = {
        exportedAt: new Date().toISOString(),
        documentUri: doc?.uri ?? null,
        profile: bridge.getActiveProfile(),
        summary: {
          errors: counts.errors,
          warnings: counts.warnings,
          infos: counts.infos,
        },
        score: bridge.getLintScoreSnapshot() ?? null,
        findings,
      };

      const defaultFilename = deriveDefaultFilename(doc?.uri ?? 'diagram.bpmn');
      const filePath = await bifrost.dialog.showSaveFile({
        defaultPath: defaultFilename,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });

      if (!filePath || filePath.trim().length === 0) {
        return;
      }

      const uri = bifrost.files.getUriForFilename(filePath);
      await bifrost.files.save(uri, JSON.stringify(report, null, 2));
    },
    {
      enabledWhen: () => {
        if (!isBpmnFocused()) {
          return false;
        }
        const bridge = getLintBridge(bifrost);
        return bridge != null && bridge.isActive() && bridge.getFindings().length > 0;
      },
    },
  );

  bifrost.commands.register(
    'bpmn.linter.runLintOnForeignDiagram',
    async () => {
      const bridge = getLintBridge(bifrost);
      if (!bridge) {
        return;
      }

      const origin = bridge.getDiagramOrigin();
      if (!origin || origin.origin === 'daemon-engine') {
        return;
      }

      const alwaysLint = bifrost.settings.get('bpmnLinter.alwaysLintForeignDiagrams') === true;
      if (alwaysLint) {
        bridge.allowForeignLinting();
        return;
      }

      const result = await bifrost.dialog.open({
        title: 'Lint Foreign Diagram?',
        content: [
          {
            type: 'markdown',
            text:
              `This diagram appears to originate from **${origin.provider}**. ` +
              "The Studio's linter rules are designed for the DaemonEngine and may produce " +
              'incorrect or misleading results on diagrams from other platforms.\n\n' +
              "Linting will also add Studio-internal metadata to the diagram's XML.",
          },
          {
            type: 'checkbox',
            id: 'rememberChoice',
            label: 'Always lint foreign diagrams (can be changed in Settings)',
            checked: false,
          },
        ],
        actions: [
          { label: 'Cancel', response: 'cancel', cancel: true },
          { label: 'Run Linter', response: 'run', default: true },
        ],
      });

      if (result?.wasCancelled || result?.response !== 'run') {
        return;
      }

      if (result.formData?.rememberChoice) {
        bifrost.settings.set('bpmnLinter.alwaysLintForeignDiagrams', true);
      }

      bridge.allowForeignLinting();
    },
    { enabledWhen: isBpmnFocused },
  );
}
