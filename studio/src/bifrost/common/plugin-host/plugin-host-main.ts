import { PluginHostConnection } from '#bifrost/contracts/PluginHostConnection';
import {
  type CallbackInvocationPayload,
  type EventPayload,
  type LoadPluginPayload,
  PH_CALLBACK_INVOCATION,
  PH_EVENT,
  PH_HOST_DISPOSE,
  PH_HOST_READY,
  PH_LOAD_PLUGIN,
  PH_PLUGIN_LOADED,
  PH_RELOAD_PLUGIN,
  PH_TRUST_AND_REENABLE,
  PH_UNLOAD_PLUGIN,
  PLUGIN_HOST_PROTOCOL_VERSION,
  type PluginHostMessage,
  type PluginLoadedPayload,
  type ReloadPluginPayload,
  type TrustAndReEnablePayload,
  type UnloadPluginPayload,
} from '#bifrost/contracts/PluginHostProtocol';
import * as os from 'os';
import * as path from 'path';

import { SandboxManager } from './sandbox/SandboxManager';

function send(message: PluginHostMessage): void {
  if (process.send) {
    process.send(message);
  }
}

const connection = new PluginHostConnection((msg) => {
  process.send!(msg);
});

function getPluginStoragePath(): string {
  if (process.env.BFR_PLUGIN_STORAGE_PATH) {
    return path.resolve(process.env.BFR_PLUGIN_STORAGE_PATH);
  }

  const platform = os.platform();
  let cacheBase: string;

  if (platform === 'darwin') {
    cacheBase = path.join(os.homedir(), 'Library', 'Caches');
  } else if (platform === 'win32') {
    cacheBase = process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local');
  } else {
    cacheBase = process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), '.cache');
  }

  const channel = process.env.BFR_STUDIO_CHANNEL ?? 'dev';
  return path.join(cacheBase, `bifrost-forge-world-${channel}`, 'plugin-storage');
}

const storagePath = getPluginStoragePath();
const sandboxManager = new SandboxManager(connection, storagePath);

async function handleMessage(message: PluginHostMessage): Promise<void> {
  switch (message.type) {
    case PH_HOST_DISPOSE:
      console.log('[PluginHost] Received dispose signal. Shutting down.');
      await sandboxManager.deactivateAll();
      connection.rejectAll('Plugin Host shutting down');
      process.exit(0);
      break;

    case PH_LOAD_PLUGIN: {
      const payload = message.payload as LoadPluginPayload;
      try {
        await sandboxManager.loadPlugin(payload);
        send({
          protocolVersion: PLUGIN_HOST_PROTOCOL_VERSION,
          type: PH_PLUGIN_LOADED,
          requestId: message.requestId,
          payload: {
            pluginName: payload.pluginName,
            success: true,
          } satisfies PluginLoadedPayload,
        });
      } catch (error: any) {
        console.error(`[PluginHost] Failed to load plugin '${payload.pluginName}':`, error);
        send({
          protocolVersion: PLUGIN_HOST_PROTOCOL_VERSION,
          type: PH_PLUGIN_LOADED,
          requestId: message.requestId,
          payload: {
            pluginName: payload.pluginName,
            success: false,
            error: error?.message ?? String(error),
          } satisfies PluginLoadedPayload,
        });
      }
      break;
    }

    case PH_UNLOAD_PLUGIN: {
      const { pluginName } = message.payload as UnloadPluginPayload;
      try {
        await sandboxManager.unloadPlugin(pluginName);
        send({
          protocolVersion: PLUGIN_HOST_PROTOCOL_VERSION,
          type: PH_UNLOAD_PLUGIN,
          requestId: message.requestId,
          payload: { pluginName, success: true },
        });
      } catch (error: any) {
        send({
          protocolVersion: PLUGIN_HOST_PROTOCOL_VERSION,
          type: PH_UNLOAD_PLUGIN,
          requestId: message.requestId,
          payload: { pluginName, success: false, error: error?.message ?? String(error) },
        });
      }
      break;
    }

    case PH_RELOAD_PLUGIN: {
      const { pluginName, pluginPath, permissions } = message.payload as ReloadPluginPayload;
      try {
        await sandboxManager.reloadPlugin(pluginName, pluginPath, permissions);
        send({
          protocolVersion: PLUGIN_HOST_PROTOCOL_VERSION,
          type: PH_RELOAD_PLUGIN,
          requestId: message.requestId,
          payload: { pluginName, success: true },
        });
      } catch (error: any) {
        send({
          protocolVersion: PLUGIN_HOST_PROTOCOL_VERSION,
          type: PH_RELOAD_PLUGIN,
          requestId: message.requestId,
          payload: { pluginName, success: false, error: error?.message ?? String(error) },
        });
      }
      break;
    }

    case PH_TRUST_AND_REENABLE: {
      const { pluginName } = message.payload as TrustAndReEnablePayload;
      sandboxManager.trustAndReEnable(pluginName);
      send({
        protocolVersion: PLUGIN_HOST_PROTOCOL_VERSION,
        type: PH_TRUST_AND_REENABLE,
        requestId: message.requestId,
        payload: { pluginName, success: true },
      });
      break;
    }

    case PH_CALLBACK_INVOCATION: {
      const { callbackId, args } = message.payload as CallbackInvocationPayload;
      const invocationId = message.requestId ?? 'unknown';
      sandboxManager.routeCallback(callbackId, args, invocationId);
      break;
    }

    case PH_EVENT: {
      const { eventName, args } = message.payload as EventPayload;
      sandboxManager.broadcastEvent(eventName, args);
      break;
    }
  }
}

process.on('message', (raw: PluginHostMessage) => {
  if (connection.handleResponse(raw)) {
    return;
  }
  handleMessage(raw);
});

process.once('disconnect', async () => {
  console.log('[PluginHost] IPC channel disconnected (parent died). Shutting down.');
  try {
    await sandboxManager.deactivateAll();
  } catch {
    // Best-effort cleanup — parent is already gone
  }
  process.exit(0);
});

process.once('SIGTERM', async () => {
  console.log('[PluginHost] Received SIGTERM. Shutting down.');
  try {
    await sandboxManager.deactivateAll();
    connection.rejectAll('Plugin Host shutting down');
  } catch {
    // Best-effort
  }
  process.exit(0);
});

process.once('SIGINT', async () => {
  console.log('[PluginHost] Received SIGINT. Shutting down.');
  try {
    await sandboxManager.deactivateAll();
    connection.rejectAll('Plugin Host shutting down');
  } catch {
    // Best-effort
  }
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('[PluginHost] Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.warn('[PluginHost] Unhandled rejection (non-fatal):', reason);
});

sandboxManager
  .initialize()
  .then(() => {
    console.log('[PluginHost] Process started and ready.');
  })
  .catch((err) => {
    console.error('[PluginHost] Initialization error (non-fatal):', err);
  })
  .finally(() => {
    send({
      protocolVersion: PLUGIN_HOST_PROTOCOL_VERSION,
      type: PH_HOST_READY,
    });
  });
