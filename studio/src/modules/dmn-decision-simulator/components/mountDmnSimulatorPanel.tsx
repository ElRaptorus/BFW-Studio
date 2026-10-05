import ReactDOM from 'react-dom/client';

import React from 'react';

import type { DmnSimulatorPanelProps } from './DmnSimulatorPanel';
import { DmnSimulatorPanel } from './DmnSimulatorPanel';

export type MountDmnSimulatorPanelOptions = Pick<
  DmnSimulatorPanelProps,
  'session' | 'bifrost' | 'describeElement' | 'onClose' | 'onReplay' | 'onRunAgain' | 'onReset' | 'onEditInput'
> & {
  /** The DRD canvas container; the panel is placed in its parent so it floats over the diagram. */
  diagramContainer: HTMLElement;
};

export function mountDmnSimulatorPanel(options: MountDmnSimulatorPanelOptions): { unmount: () => void } {
  const host =
    options.diagramContainer.closest<HTMLElement>('.dmn-drd-container') ?? options.diagramContainer.parentElement;
  if (host == null) {
    return { unmount: () => undefined };
  }
  host.classList.add('dmn-sim-host');
  const container = document.createElement('div');
  container.className = 'dmn-sim-panel-container';
  host.appendChild(container);
  const root = ReactDOM.createRoot(container);
  root.render(
    React.createElement(DmnSimulatorPanel, {
      session: options.session,
      bifrost: options.bifrost,
      describeElement: options.describeElement,
      onClose: options.onClose,
      onReplay: options.onReplay,
      onRunAgain: options.onRunAgain,
      onReset: options.onReset,
      onEditInput: options.onEditInput,
    }),
  );
  return {
    unmount: () => {
      host.classList.remove('dmn-sim-host');
      setTimeout(() => {
        root.unmount();
        container.remove();
      }, 0);
    },
  };
}
