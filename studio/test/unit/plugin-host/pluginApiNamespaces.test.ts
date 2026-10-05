import { describe, expect, it, vi } from 'vitest';

import type { PluginApiNamespace } from '../../../src/bifrost/contracts/PluginHostTypes';

vi.mock('electron', () => ({ ipcRenderer: { on: vi.fn(), invoke: vi.fn(), send: vi.fn() } }));

const { PluginHostBridge } = await import('../../../src/bifrost/electron-renderer/plugin-host/PluginHostBridge');

function createNamespace(namespace: 'bpmn' | 'dmn'): PluginApiNamespace {
  return {
    namespace,
    handleApiRequest: vi.fn(async () => 'handled'),
    registerCallback: vi.fn(),
    deliverRendererModuleMessage: vi.fn(),
    registerContributions: vi.fn(() => []),
    disposePlugin: vi.fn(),
    dispose: vi.fn(),
  };
}

function createBridge() {
  return new PluginHostBridge({} as never, {} as never, {} as never);
}

describe('PluginHostBridge API namespaces', () => {
  it('rejects a second registration of the same namespace', () => {
    const bridge = createBridge();
    bridge.registerApiNamespace(() => createNamespace('bpmn'));
    expect(() => bridge.registerApiNamespace(() => createNamespace('bpmn'))).toThrow(/already registered/);
  });

  it('fails an API request to an unregistered namespace', async () => {
    const bridge = createBridge();
    await expect(
      bridge.executeApiRequest({ namespace: 'dmn', method: 'getElements', args: [], pluginName: 'probe' } as never),
    ).rejects.toThrow('Unknown API namespace: dmn');
  });

  it('gates requests by the namespace permission tiers before delegating', async () => {
    const bridge = createBridge();
    const bpmn = createNamespace('bpmn');
    bridge.registerApiNamespace(() => bpmn);
    const request = (method: string) =>
      bridge.executeApiRequest({ namespace: 'bpmn', method, args: [], pluginName: 'probe' } as never);

    await expect(request('getElements')).rejects.toThrow("permission 'bpmn' denied");

    bridge.permissionGate.register('probe', ['bpmn']);
    await expect(request('getElements')).resolves.toBe('handled');
    await expect(request('modeling.updateProperties')).rejects.toThrow("permission 'bpmn.modelling' denied");
    await expect(request('postToRendererModule')).rejects.toThrow("permission 'bpmn.renderer' denied");
    expect(bpmn.handleApiRequest).toHaveBeenCalledTimes(1);
  });

  it('passes the renderer-module fan-out to the factory and every namespace', () => {
    const bridge = createBridge();
    const bpmn = createNamespace('bpmn');
    const dmn = createNamespace('dmn');
    let deliver: ((pluginName: string, data: unknown) => void) | undefined;
    bridge.registerApiNamespace((context) => {
      deliver = context.deliverRendererModuleMessage;
      return bpmn;
    });
    bridge.registerApiNamespace(() => dmn);

    deliver?.('probe', { ping: true });

    expect(bpmn.deliverRendererModuleMessage).toHaveBeenCalledWith('probe', { ping: true });
    expect(dmn.deliverRendererModuleMessage).toHaveBeenCalledWith('probe', { ping: true });
    expect([...bridge.getApiNamespaces()]).toEqual([bpmn, dmn]);
  });
});
