import type { Bifrost } from '#bifrost/Bifrost';

export function initializeSettings(bifrost: Bifrost): void {
  bifrost.settings.register({
    'gitCruiser.general.enabled': {
      category: 'Git',
      type: 'boolean',
      label: 'Enable Git Integration',
      description: 'Enable or disable git integration globally.',
      default: true,
    },
    'gitCruiser.general.autoRefresh': {
      category: 'Git',
      type: 'boolean',
      label: 'Auto-Refresh Git Status',
      description: 'Automatically refresh git status when files are saved or changed externally.',
      default: true,
    },
    'gitCruiser.general.refreshDebounceMs': {
      category: 'Git',
      type: 'number',
      label: 'Refresh Debounce (ms)',
      description: 'Debounce interval in milliseconds for git status refresh.',
      default: 500,
    },
    'gitCruiser.confirm.revertFile': {
      category: 'Git',
      type: 'boolean',
      label: 'Confirm Before Reverting',
      description: 'Show a confirmation dialog before reverting changes to a file.',
      default: true,
    },
    'gitCruiser.suggest.gitignore': {
      category: 'Git',
      type: 'boolean',
      label: 'Suggest .gitignore',
      description: 'Suggest creating a .gitignore file when a repository has none.',
      default: true,
    },
    'gitCruiser.protect.diagrams': {
      category: 'Git',
      type: 'array',
      label: 'Protected Diagram Patterns',
      description:
        'Glob patterns for protected BPMN diagrams. A warning will be shown before committing changes to matching files. Project-level settings in .bifrostfw/git-cruiser.json take precedence.',
      default: [],
    },
  });
}
