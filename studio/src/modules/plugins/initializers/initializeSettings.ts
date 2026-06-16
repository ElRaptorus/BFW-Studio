import type { Bifrost } from '#bifrost/Bifrost';

export function initializeSettings(bifrost: Bifrost): void {
  bifrost.settings.register({
    'plugins.disabledPlugins': {
      category: 'Plugins',
      type: 'array',
      label: 'Disabled Plugins',
      description: 'List of plugin names that are disabled and will not be loaded on startup.',
      default: [],
    },
    'plugins.permissions.showDialogOnEnable': {
      category: 'Plugins',
      type: 'boolean',
      label: 'Show Permission Dialog',
      description: 'Show a permission review dialog when enabling a plugin for the first time.',
      default: true,
    },
    'plugins.quarantine.maxCrashes': {
      category: 'Plugins',
      type: 'number',
      label: 'Quarantine Crash Threshold',
      description: 'Number of crashes within the time window before a plugin is quarantined.',
      default: 3,
    },
    'plugins.quarantine.windowMs': {
      category: 'Plugins',
      type: 'number',
      label: 'Quarantine Time Window (ms)',
      description: 'Time window in milliseconds for counting plugin crashes.',
      default: 60000,
    },
    'plugins.quarantine.enabled': {
      category: 'Plugins',
      type: 'boolean',
      label: 'Enable Quarantine',
      description: 'Automatically quarantine plugins that repeatedly crash.',
      default: true,
    },
  });
}
