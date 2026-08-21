/**
 * Bidirectional conformance between the Engine extension vocabulary
 * (`extensionManifest` from `@elraptorus/daemonengine_sdk`) and the Studio's
 * hand-written moddle descriptor (`evil-platform.json`).
 *
 * Pure function — no rspack or vitest coupling, so it can later be reused
 * from a watch-mode plugin or a postinstall hook without rewriting.
 */

export type ExtensionValueKind = 'feel' | 'json_schema' | 'static_string' | 'integer' | 'boolean' | 'mapping';
export type ExtensionCarrier = 'body' | 'attributes';

export interface ExtensionManifestEntry {
  element: string;
  valueKind: ExtensionValueKind;
  carrier: ExtensionCarrier;
  attributes: string[];
  applicableTo: string[];
  modelField: string;
}

export interface ExtensionManifest {
  elements: ExtensionManifestEntry[];
  extensible: string[];
}

export interface ModdleProperty {
  name: string;
  type?: string;
  isAttr?: boolean;
  isBody?: boolean;
  isMany?: boolean;
}

export interface ModdleType {
  name: string;
  superClass?: string[];
  extends?: string[];
  isAbstract?: boolean;
  meta?: { allowedIn?: string[] };
  properties?: ModdleProperty[];
}

export interface ModdleDescriptor {
  name?: string;
  prefix?: string;
  types: ModdleType[];
}

export interface ConformanceViolation {
  direction: 'manifest-to-descriptor' | 'descriptor-to-manifest' | 'allowedIn-subset';
  element: string;
  message: string;
}

export interface ConformanceResult {
  ok: boolean;
  violations: ConformanceViolation[];
}

const VALUE_KIND_TO_MODDLE_TYPE: Record<ExtensionValueKind, string | null> = {
  integer: 'Integer',
  boolean: 'Boolean',
  feel: 'String',
  json_schema: 'String',
  static_string: 'String',
  mapping: null,
};

/**
 * Compare `manifest` against `descriptor`. A missing `extensionManifest` is
 * a conformance failure.
 */
export function verifyModdleConformance(
  manifest: ExtensionManifest | null | undefined,
  descriptor: ModdleDescriptor,
): ConformanceResult {
  if (manifest == null || !Array.isArray(manifest.elements)) {
    return {
      ok: false,
      violations: [
        {
          direction: 'manifest-to-descriptor',
          element: 'extensionManifest',
          message: '@elraptorus/daemonengine_sdk must export extensionManifest. The Studio does not skip this check.',
        },
      ],
    };
  }

  const violations: ConformanceViolation[] = [];
  const extensible = new Set((manifest.extensible ?? []).map(normalizeName));
  const descriptorTypes = descriptor.types ?? [];
  const typesByNormalizedName = new Map<string, ModdleType>();
  for (const type of descriptorTypes) {
    typesByNormalizedName.set(normalizeName(type.name), type);
  }

  for (const entry of manifest.elements) {
    const type = typesByNormalizedName.get(normalizeName(entry.element));
    if (!type) {
      violations.push({
        direction: 'manifest-to-descriptor',
        element: entry.element,
        message: `manifest element '${entry.element}' has no matching moddle type — the Studio cannot author what the Engine executes`,
      });
      continue;
    }

    const expectedModdleType = VALUE_KIND_TO_MODDLE_TYPE[entry.valueKind];
    if (entry.valueKind === 'mapping') {
      const propertyNames = collectPropertyNames(type, typesByNormalizedName);
      for (const attribute of entry.attributes) {
        if (!propertyNames.has(attribute)) {
          violations.push({
            direction: 'manifest-to-descriptor',
            element: entry.element,
            message: `mapping element '${entry.element}' is missing moddle attribute '${attribute}'`,
          });
        }
      }
    } else if (expectedModdleType) {
      const bodyOrValueProperty = (type.properties ?? []).find(
        (property) => property.isBody || property.name === 'body',
      );
      const actualType = bodyOrValueProperty?.type ?? type.properties?.[0]?.type;
      if (actualType && actualType !== expectedModdleType) {
        violations.push({
          direction: 'manifest-to-descriptor',
          element: entry.element,
          message: `valueKind '${entry.valueKind}' expects moddle type '${expectedModdleType}', found '${actualType}'`,
        });
      }
    }

    const allowedIn = type.meta?.allowedIn ?? [];
    if (allowedIn.length > 0 && !allowedIn.includes('*')) {
      const applicable = new Set(entry.applicableTo.map(normalizeApplicableTo));
      if (applicable.has('flownodeanytype') || applicable.has('flownode(anytype)')) {
        continue;
      }
      for (const allowed of allowedIn) {
        const normalizedAllowed = normalizeAllowedIn(allowed);
        if (!applicableHas(applicable, normalizedAllowed, entry.applicableTo)) {
          violations.push({
            direction: 'allowedIn-subset',
            element: entry.element,
            message: `moddle allowedIn '${allowed}' is not ⊆ manifest applicableTo [${entry.applicableTo.join(', ')}] — the Studio must not be more permissive than the Engine`,
          });
        }
      }
    }
  }

  const manifestNames = new Set(manifest.elements.map((entry) => normalizeName(entry.element)));
  for (const type of descriptorTypes) {
    if (type.isAbstract) {
      continue;
    }
    if (isBpmnOverlay(type)) {
      continue;
    }
    const normalized = normalizeName(type.name);
    if (extensible.has(normalized)) {
      continue;
    }
    if (!manifestNames.has(normalized)) {
      violations.push({
        direction: 'descriptor-to-manifest',
        element: type.name,
        message: `moddle type '${type.name}' has no matching manifest element — the Studio would author an extension the Engine silently drops`,
      });
    }
  }

  return { ok: violations.length === 0, violations };
}

function collectPropertyNames(type: ModdleType, typesByNormalizedName: Map<string, ModdleType>): Set<string> {
  const names = new Set<string>();
  const visited = new Set<string>();
  const walk = (current: ModdleType | undefined): void => {
    if (!current || visited.has(current.name)) {
      return;
    }
    visited.add(current.name);
    for (const property of current.properties ?? []) {
      names.add(property.name);
    }
    for (const parent of current.superClass ?? []) {
      walk(typesByNormalizedName.get(normalizeName(parent)));
    }
  };
  walk(type);
  return names;
}

function isBpmnOverlay(type: ModdleType): boolean {
  const parents = [...(type.superClass ?? []), ...(type.extends ?? [])];
  return parents.some((parent) => parent.startsWith('bpmn:'));
}

function normalizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function normalizeAllowedIn(allowedIn: string): string {
  return allowedIn
    .replace(/^bpmn:/, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function normalizeApplicableTo(applicableTo: string): string {
  return applicableTo.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function applicableHas(applicable: Set<string>, normalizedAllowed: string, rawApplicableTo: string[]): boolean {
  if (applicable.has(normalizedAllowed)) {
    return true;
  }

  // Engine `applicableTo` names parent event positions (`EndEvent`); Studio
  // `allowedIn` names the event-definition carrier (`bpmn:ErrorEventDefinition`).
  const carrierPositions = EVENT_DEFINITION_CARRIERS[normalizedAllowed];
  if (carrierPositions?.some((position) => applicable.has(position))) {
    return true;
  }

  // "SubProcess (adHocSubProcess)" covers bpmn:AdHocSubProcess and bpmn:SubProcess.
  for (const raw of rawApplicableTo) {
    const normalized = normalizeApplicableTo(raw);
    if (
      normalized.includes(normalizedAllowed) ||
      normalizedAllowed.includes(normalized.replace(/adhocsubprocess/g, 'subprocess'))
    ) {
      return true;
    }
  }
  return false;
}

const EVENT_DEFINITION_CARRIERS: Record<string, string[]> = {
  erroreventdefinition: ['endevent', 'boundaryevent', 'startevent'],
  messageeventdefinition: [
    'startevent',
    'intermediatecatchevent',
    'intermediatethrowevent',
    'endevent',
    'boundaryevent',
    'sendtask',
    'receivetask',
  ],
};
