import type { Bifrost } from '#bifrost/Bifrost';

interface PaletteProviderInstance {
  bridge: { isActive: () => boolean };
  bifrost: Bifrost;
}

const ACTIVE_CLASS = 'dmn-sim-palette-entry--active';

/** Adds the "Toggle decision simulator" entry to the DRD palette. */
export function DmnSimulatorPaletteProvider(
  this: PaletteProviderInstance,
  palette: any,
  dmnSimulatorBridge: { isActive: () => boolean },
  eventBus: any,
  canvas: any,
  dmnSimulatorHost: { bifrost: Bifrost },
) {
  this.bridge = dmnSimulatorBridge;
  this.bifrost = dmnSimulatorHost.bifrost;
  palette.registerProvider(598, this);
  // diagram-js has no public palette refresh; toggling the entry's DOM directly avoids a private `_update()` call.
  eventBus.on('dmnSimulator.toggled', ({ active }: { active: boolean }) => {
    const entry = canvas
      .getContainer()
      .closest('.djs-container')
      ?.querySelector('.djs-palette [data-action="dmn-sim-toggle"]');
    entry?.classList.toggle(ACTIVE_CLASS, active);
    entry?.setAttribute('title', active ? 'Deactivate decision simulator' : 'Activate decision simulator');
  });
}

DmnSimulatorPaletteProvider.prototype.getPaletteEntries = function (this: PaletteProviderInstance) {
  const isActive = this.bridge.isActive();
  return {
    'dmn-sim-toggle': {
      group: 'z-extensions',
      className: `ph ph-play-circle dmn-sim-palette-entry${isActive ? ` ${ACTIVE_CLASS}` : ''}`,
      title: isActive ? 'Deactivate decision simulator' : 'Activate decision simulator',
      action: { click: () => void this.bifrost.commands.executeCommand('dmn.simulator.toggle', [this.bridge]) },
    },
  };
};

(DmnSimulatorPaletteProvider as any).$inject = [
  'palette',
  'dmnSimulatorBridge',
  'eventBus',
  'canvas',
  'dmnSimulatorHost',
];
