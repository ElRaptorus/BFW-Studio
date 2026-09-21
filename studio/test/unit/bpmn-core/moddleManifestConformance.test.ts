import { describe, expect, it } from 'vitest';

import { extensionManifest } from '@elraptorus/bfw_engine_sdk';

import bfwPlatformModdleDescriptor from '../../../src/modules/bpmn-core/bpmn-js/moddle/bfw-platform.json';
import {
  type ExtensionManifest,
  type ModdleDescriptor,
  verifyModdleConformance,
} from '../../../src/modules/bpmn-core/moddle/verifyModdleConformance';

describe('moddle ↔ extension-manifest conformance', () => {
  it('fails when the SDK has no manifest', () => {
    const result = verifyModdleConformance(null, { types: [] });
    expect(result.ok).toBe(false);
    expect(result.violations[0]?.element).toBe('extensionManifest');
  });

  it('reports every violation in one pass, naming element and direction', () => {
    const manifest: ExtensionManifest = {
      extensible: ['Properties', 'Property'],
      elements: [
        {
          element: 'httpUrl',
          valueKind: 'static_string',
          carrier: 'body',
          attributes: [],
          applicableTo: ['ServiceTask'],
          modelField: 'http_url',
        },
        {
          element: 'onlyInManifest',
          valueKind: 'feel',
          carrier: 'body',
          attributes: [],
          applicableTo: ['ServiceTask'],
          modelField: 'x',
        },
      ],
    };
    const descriptor: ModdleDescriptor = {
      types: [
        {
          name: 'HttpUrl',
          superClass: ['Element'],
          meta: { allowedIn: ['bpmn:UserTask'] },
          properties: [{ name: 'body', isBody: true, type: 'String' }],
        },
        {
          name: 'GhostExtension',
          superClass: ['Element'],
          properties: [{ name: 'body', isBody: true, type: 'String' }],
        },
      ],
    };

    const result = verifyModdleConformance(manifest, descriptor);
    expect(result.ok).toBe(false);
    expect(result.violations.map((violation) => `${violation.direction}:${violation.element}`).sort()).toEqual([
      'allowedIn-subset:httpUrl',
      'descriptor-to-manifest:GhostExtension',
      'manifest-to-descriptor:onlyInManifest',
    ]);
  });

  it('treats event-definition carriers as matching the parent event positions', () => {
    const manifest: ExtensionManifest = {
      extensible: [],
      elements: [
        {
          element: 'errorCode',
          valueKind: 'static_string',
          carrier: 'body',
          attributes: [],
          applicableTo: ['EndEvent', 'BoundaryEvent'],
          modelField: 'x',
        },
      ],
    };
    const descriptor: ModdleDescriptor = {
      types: [
        {
          name: 'ErrorCode',
          superClass: ['Element'],
          meta: { allowedIn: ['bpmn:ErrorEventDefinition'] },
          properties: [{ name: 'body', isBody: true, type: 'String' }],
        },
      ],
    };

    expect(verifyModdleConformance(manifest, descriptor).ok).toBe(true);
  });

  it('treats FlowNode (any type) as covering every concrete allowedIn host', () => {
    const manifest: ExtensionManifest = {
      extensible: [],
      elements: [
        {
          element: 'dataContract',
          valueKind: 'json_schema',
          carrier: 'body',
          attributes: [],
          applicableTo: ['FlowNode (any type)'],
          modelField: 'x',
        },
      ],
    };
    const descriptor: ModdleDescriptor = {
      types: [
        {
          name: 'DataContract',
          superClass: ['Element'],
          meta: { allowedIn: ['bpmn:UserTask', 'bpmn:ServiceTask'] },
          properties: [{ name: 'body', isBody: true, type: 'String' }],
        },
      ],
    };

    expect(verifyModdleConformance(manifest, descriptor).ok).toBe(true);
  });

  it('asserts bidirectional conformance against the shipped SDK manifest', () => {
    expect(extensionManifest).toBeDefined();
    expect(Array.isArray(extensionManifest.elements)).toBe(true);

    const result = verifyModdleConformance(extensionManifest, bfwPlatformModdleDescriptor as ModdleDescriptor);
    if (!result.ok) {
      const report = result.violations
        .map((violation) => `[${violation.direction}] ${violation.element}: ${violation.message}`)
        .join('\n');
      expect.fail(`moddle/manifest conformance failed:\n${report}`);
    }
  });
});
