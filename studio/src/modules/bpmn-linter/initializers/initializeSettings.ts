import type { Bifrost } from '#bifrost/Bifrost';

export function initializeSettings(bifrost: Bifrost): void {
  bifrost.settings.register({
    'bpmnLinter.enabled': {
      category: 'BPMN Linter',
      scope: 'project',
      type: 'boolean',
      label: 'Enable live linting in the BPMN editor',
      description:
        'Show overlays, the Findings pane, and the error-summary badge, and auto-lint while editing a BPMN diagram. File Explorer Lint File / Folder / Solution is always available.',
      default: false,
    },
    'bpmnLinter.autoLintDelay': {
      category: 'BPMN Linter',
      scope: 'project',
      type: 'number',
      label: 'Auto-Lint Delay (ms)',
      description: 'Debounce delay in milliseconds before auto-lint runs after a model change.',
      default: 300,
    },
    'bpmnLinter.profile': {
      category: 'BPMN Linter',
      scope: 'project',
      type: 'string',
      label: 'Active Ruleset',
      description:
        'The active lint ruleset. Can be a built-in name (bpmn-development, bpmn-production-ready) or a custom ruleset name.',
      default: 'bpmn-development',
    },
    'bpmnLinter.customRulesets': {
      category: 'BPMN Linter',
      scope: 'project',
      type: 'object',
      label: 'Custom Rulesets',
      description:
        'Dictionary of custom rulesets. Key is the ruleset name, value is the ruleset configuration: `base` (built-in profile id), optional `rules` overrides, and optional `scorePolicy` (`validMinPercent`, `riskyMinPercent`, `instantFailOnAnyError`, `instantRiskOnAnyWarning`) for linter score thresholds.',
      default: {},
    },
    'bpmnLinter.alwaysLintForeignDiagrams': {
      category: 'BPMN Linter',
      scope: 'project',
      type: 'boolean',
      label: 'Always run the linter on diagrams from other platforms',
      description:
        'When enabled, the linter auto-runs on all diagrams regardless of origin. When disabled, diagrams from foreign platforms (Camunda, Zeebe, Flowable, etc.) are not auto-linted to avoid false positives and unintended XML mutations.',
      default: false,
    },
  });
}
