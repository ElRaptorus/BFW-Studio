import type { BpmnDefinitions } from '@elraptorus/daemonengine_sdk';
import { describe, expect, it } from 'vitest';

import {
  resolveEscalationCode,
  resolveEscalationName,
} from '../../../src/modules/engine-debugger/libs/BpmnProcessHelpers';

function makeDefinitions(): BpmnDefinitions {
  return {
    definitionsId: 'Definitions_1',
    processes: [],
    messages: [],
    signals: [],
    errors: [],
    escalations: [
      { id: 'Esc_Api', name: 'api-inject', escalationCode: 'ESC_API' },
      { id: 'Esc_Blank', name: 'unnamed', escalationCode: null },
    ],
    rawXml: '',
  };
}

describe('resolveEscalationCode', () => {
  it('resolves the global escalationCode from escalationRef', () => {
    const definitions = makeDefinitions();
    expect(resolveEscalationCode(definitions, 'Esc_Api')).toBe('ESC_API');
    expect(resolveEscalationName(definitions, 'Esc_Api')).toBe('api-inject');
  });

  it('returns null for a missing ref, unknown id, or blank code', () => {
    const definitions = makeDefinitions();
    expect(resolveEscalationCode(definitions, null)).toBeNull();
    expect(resolveEscalationCode(definitions, 'Esc_Missing')).toBeNull();
    expect(resolveEscalationCode(definitions, 'Esc_Blank')).toBeNull();
  });
});
