import type { Bifrost } from '#bifrost/Bifrost';

export function initializeDmnSettings(bifrost: Bifrost): void {
  bifrost.settings.register({
    'dmn.editor.showGrid': {
      category: 'DMN Editor',
      type: 'boolean',
      label: 'Show Grid',
      description: 'Display a grid overlay on the DMN DRD canvas.',
      default: true,
    },
    'dmn.editor.showMinimap': {
      category: 'DMN Editor',
      type: 'boolean',
      label: 'Show Minimap',
      description: 'Display a minimap on the DMN DRD canvas.',
      default: false,
    },
    'dmn.editor.defaultHitPolicy': {
      category: 'DMN Editor',
      type: 'string',
      label: 'Default Hit Policy',
      description: 'The default hit policy for new decision tables.',
      default: 'UNIQUE',
      enum: ['UNIQUE', 'FIRST', 'ANY', 'COLLECT', 'RULE ORDER', 'OUTPUT ORDER', 'PRIORITY'],
      enumLabels: {
        UNIQUE: 'Unique',
        FIRST: 'First',
        ANY: 'Any',
        COLLECT: 'Collect',
        'RULE ORDER': 'Rule Order',
        'OUTPUT ORDER': 'Output Order',
        PRIORITY: 'Priority',
      },
    },
    'dmn.editor.autoValidate': {
      category: 'DMN Editor',
      type: 'boolean',
      label: 'Auto-Validate',
      description: 'Automatically run client-side validation when the DMN model changes.',
      default: true,
    },
  });
}
