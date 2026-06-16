import type EventBus from 'diagram-js/lib/core/EventBus';
import type Palette from 'diagram-js/lib/features/palette/Palette';
import type { PaletteEntries } from 'diagram-js/lib/features/palette/PaletteProvider';

type PaletteWithInternals = Palette & { _rebuild(): void };

interface LintBridgePalette {
  isActive(): boolean;
  toggle(): void;
}

interface LinterPaletteProviderInstance {
  palette: PaletteWithInternals;
  lintBridge: LintBridgePalette;
  getPaletteEntries(): PaletteEntries;
}

/**
 * Diagram-js palette provider that adds a "Toggle Linter" entry
 * to the BPMN palette. Reflects the current linter active state.
 */
export function LinterPaletteProvider(
  this: LinterPaletteProviderInstance,
  palette: PaletteWithInternals,
  lintBridge: LintBridgePalette,
  eventBus: EventBus,
) {
  this.palette = palette;
  this.lintBridge = lintBridge;

  palette.registerProvider(600, this);

  eventBus.on('lintBridge.toggled', () => {
    palette._rebuild();
  });
}

LinterPaletteProvider.prototype.getPaletteEntries = function (this: LinterPaletteProviderInstance) {
  const isActive = this.lintBridge.isActive();
  const activeClass = isActive ? ' lint-palette-entry--active' : '';

  return {
    'ext-separator': {
      group: 'z-extensions',
      separator: true,
    },
    'lint-toggle': {
      group: 'z-extensions',
      className: `lint-palette-entry${activeClass}`,
      title: isActive ? 'Deactivate linting' : 'Activate linting',
      action: {
        click: () => {
          this.lintBridge.toggle();
        },
      },
    },
  };
};

// diagram-js injection metadata — no typed alternative exists
(LinterPaletteProvider as any).$inject = ['palette', 'lintBridge', 'eventBus'];
