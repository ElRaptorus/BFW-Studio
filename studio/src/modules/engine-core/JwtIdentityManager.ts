import type { Bifrost } from '#bifrost/Bifrost';
import type { JwtFactory } from '@elraptorus/daemonengine_client';

import { SETTINGS_KEYS } from './settings/registerSettings';
import type { JwtClaims } from './types';

const BOOLEAN_GATED_CLAIMS = ['deploy_bpmn', 'deploy_dmn', 'delete_bpmn', 'delete_dmn', 'zeeky_boogie_doog'] as const;

const STRING_GATED_CLAIMS = [
  'abort_process_instance',
  'retry_process_instance',
  'delete_process_instance',
  'trigger_message',
  'trigger_signal',
] as const;

export type EngineCapability = (typeof BOOLEAN_GATED_CLAIMS)[number] | (typeof STRING_GATED_CLAIMS)[number];

/**
 * Manages per-engine JWT tokens stored in the Settings mediator.
 * Provides a JwtFactory closure for DaemonEngineClient construction,
 * and decodes claims (without validation) for UI capability gating.
 */
export class JwtIdentityManager {
  private readonly bifrost: Bifrost;
  private claimsCache = new Map<string, JwtClaims>();

  constructor(bifrost: Bifrost) {
    this.bifrost = bifrost;
  }

  getToken(engineUrl: string): string | undefined {
    const tokens: Record<string, string> = this.bifrost.settings.get(SETTINGS_KEYS.authTokens) ?? {};
    return tokens[engineUrl] || undefined;
  }

  setToken(engineUrl: string, token?: string): void {
    if (!token) {
      this.bifrost.settings.removeValue(SETTINGS_KEYS.authTokens, engineUrl);
      this.claimsCache.delete(engineUrl);
    } else {
      this.bifrost.settings.add(SETTINGS_KEYS.authTokens, { [engineUrl]: token });
      this.claimsCache.delete(engineUrl);
    }
  }

  hasToken(engineUrl: string): boolean {
    return this.getToken(engineUrl) != null;
  }

  /**
   * Returns a JwtFactory closure suitable for DaemonEngineClient construction.
   * The factory resolves the stored token at call time (not at construction time),
   * so token updates are picked up automatically.
   */
  createTokenFactory(engineUrl: string): JwtFactory {
    return () => {
      const token = this.getToken(engineUrl);
      if (!token) {
        throw new Error(`No auth token configured for engine at ${engineUrl}`);
      }
      return token;
    };
  }

  getClaims(engineUrl: string): JwtClaims {
    const cached = this.claimsCache.get(engineUrl);
    if (cached) {
      return cached;
    }

    const token = this.getToken(engineUrl);
    if (!token) {
      return { sub: undefined, lanes: [], capabilities: [], raw: {} };
    }

    const claims = decodeJwtClaims(token);
    this.claimsCache.set(engineUrl, claims);
    return claims;
  }

  hasCapability(engineUrl: string, capability: EngineCapability): boolean {
    const claims = this.getClaims(engineUrl);
    if (claims.capabilities.includes('zeeky_boogie_doog')) {
      return true;
    }
    return claims.capabilities.includes(capability);
  }

  getSubject(engineUrl: string): string | undefined {
    return this.getClaims(engineUrl).sub;
  }

  getLanes(engineUrl: string): string[] {
    return this.getClaims(engineUrl).lanes;
  }
}

function decodeJwtClaims(token: string): JwtClaims {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { sub: undefined, lanes: [], capabilities: [], raw: {} };
    }

    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    const lanes: string[] = [];
    const capabilities: string[] = [];

    for (const [key, value] of Object.entries(payload)) {
      if (key.startsWith('lane:') && value === true) {
        lanes.push(key.slice(5));
      } else if ((BOOLEAN_GATED_CLAIMS as readonly string[]).includes(key) && value === true) {
        capabilities.push(key);
      } else if ((STRING_GATED_CLAIMS as readonly string[]).includes(key) && (value === 'all' || value === 'own')) {
        capabilities.push(key);
      }
    }

    return {
      sub: payload.sub ?? undefined,
      lanes,
      capabilities,
      raw: payload,
    };
  } catch {
    return { sub: undefined, lanes: [], capabilities: [], raw: {} };
  }
}
