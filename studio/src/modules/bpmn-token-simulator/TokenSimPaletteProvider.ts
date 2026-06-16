interface TokenSimPaletteProviderInstance {
  palette: any;
  tokenSimulationBridge: any;
  getPaletteEntries(): Record<string, any>;
}

/**
 * Diagram-js palette provider that adds a "Toggle Token Simulation" entry
 * to the BPMN palette. Reflects the current simulator active state.
 */
export function TokenSimPaletteProvider(
  this: TokenSimPaletteProviderInstance,
  palette: any,
  tokenSimulationBridge: any,
  eventBus: any,
) {
  this.palette = palette;
  this.tokenSimulationBridge = tokenSimulationBridge;

  palette.registerProvider(599, this);

  eventBus.on('tokenSimBridge.toggled', () => {
    palette._rebuild();
  });
}

TokenSimPaletteProvider.prototype.getPaletteEntries = function (this: TokenSimPaletteProviderInstance) {
  const isActive = this.tokenSimulationBridge.isActive();
  const activeClass = isActive ? ' token-sim-palette-entry--active' : '';

  return {
    'token-sim-toggle': {
      group: 'z-extensions',
      className: `token-sim-palette-entry${activeClass}`,
      title: isActive ? 'Deactivate token simulation' : 'Activate token simulation',
      action: {
        click: () => {
          this.tokenSimulationBridge.toggle();
        },
      },
    },
  };
};

(TokenSimPaletteProvider as any).$inject = ['palette', 'tokenSimulationBridge', 'eventBus'];
