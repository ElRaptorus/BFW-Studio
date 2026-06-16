import { type TokenSimulationBridgeServices, TokenSimulationController } from './TokenSimulationController';
import type { TokenSimSettingsAccessor } from './index';

interface BridgeInstance extends TokenSimulationBridgeServices {
  controller: TokenSimulationController | null;
  toggle: () => void;
  isActive: () => boolean;
}

export function TokenSimulationBridge(
  this: BridgeInstance,
  eventBus: any,
  canvas: any,
  elementRegistry: any,
  overlays: any,
  tokenSimSettings: TokenSimSettingsAccessor,
) {
  this.canvas = canvas;
  this.elementRegistry = elementRegistry;
  this.overlays = overlays;
  this.eventBus = eventBus;
  this.tokenSimSettings = tokenSimSettings;
  this.controller = null;

  this.toggle = () => {
    if (!this.controller) {
      this.controller = new TokenSimulationController(this, () => {
        this.controller = null;
        eventBus.fire('tokenSimBridge.toggled', { active: false });
      });
    }
    if (this.controller.isActive()) {
      this.controller.dispose();
      this.controller = null;
    } else {
      this.controller.activate();
    }
    eventBus.fire('tokenSimBridge.toggled', { active: this.isActive() });
  };

  this.isActive = () => {
    return this.controller?.isActive() ?? false;
  };

  eventBus.on('attach', () => {
    if (this.controller?.isActive()) {
      this.controller.remountToolbar();
    }
  });

  eventBus.on('diagram.destroy', () => {
    this.controller?.dispose();
    this.controller = null;
  });
}

(TokenSimulationBridge as any).$inject = ['eventBus', 'canvas', 'elementRegistry', 'overlays', 'tokenSimSettings'];
