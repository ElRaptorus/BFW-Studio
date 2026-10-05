import type { DmnSimulatorHost } from './DmnSimulatorController';
import { DmnSimulatorController } from './DmnSimulatorController';
import { DmnSimulatorSession } from './DmnSimulatorSession';
import { DmnSimulatorTableHighlighter } from './DmnSimulatorTableHighlighter';

interface BridgeInstance {
  session: DmnSimulatorSession;
  controller: DmnSimulatorController | null;
  tableHighlighter: DmnSimulatorTableHighlighter | null;
  toggle: (host: DmnSimulatorHost) => void;
  isActive: () => boolean;
  getSession: () => DmnSimulatorSession;
}

/** Diagram-js service that owns the simulator of one DRD canvas. Registered through `dmn.modeler.registerModule`. */
export function DmnSimulatorBridge(
  this: BridgeInstance,
  eventBus: any,
  canvas: any,
  elementRegistry: any,
  overlays: any,
) {
  this.session = new DmnSimulatorSession();
  this.controller = null;
  this.tableHighlighter = null;

  this.toggle = (host) => {
    if (this.controller?.isActive()) {
      this.controller.deactivate();
      return;
    }
    this.tableHighlighter ??= new DmnSimulatorTableHighlighter(host.adapter, this.session);
    this.controller ??= new DmnSimulatorController(
      { canvas, elementRegistry, overlays, eventBus },
      host,
      this.session,
      () => eventBus.fire('dmnSimulator.toggled', { active: false }),
    );
    this.controller.activate();
    eventBus.fire('dmnSimulator.toggled', { active: true });
  };

  this.isActive = () => this.controller?.isActive() ?? false;
  this.getSession = () => this.session;

  eventBus.on('diagram.destroy', () => {
    this.controller?.dispose();
    this.controller = null;
    this.tableHighlighter?.dispose();
    this.tableHighlighter = null;
  });
}

(DmnSimulatorBridge as any).$inject = ['eventBus', 'canvas', 'elementRegistry', 'overlays'];
