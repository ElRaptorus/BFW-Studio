import { ALL_PERMISSIONS, type PluginPermission } from '../permissions/PermissionTypes';
import type {
  ActivationEvent,
  BifrostStudioManifest,
  KeybindingWhenCondition,
  ManifestBpmnContextPadEntry,
  ManifestBpmnPaletteEntry,
  ManifestCommand,
  ManifestContributions,
  ManifestError,
  ManifestKeybinding,
  ManifestMenuItem,
  ManifestPaneContribution,
  ManifestPaneToggle,
  ManifestReadResult,
  ManifestServiceTaskType,
  ManifestSetting,
  ManifestTheme,
  ManifestWarning,
} from './ManifestTypes';

const VALID_PERMISSIONS = new Set<string>(ALL_PERMISSIONS);
const RESERVED_PERMISSIONS = new Set(['network']);
const HARD_DENIED_PERMISSION_GROUPS = new Set(['commands.engine', 'commands.git', 'commands.dev']);

const VALID_SETTING_TYPES = new Set(['boolean', 'string', 'number', 'string[]', 'object']);
const VALID_PANE_AREAS = new Set(['left', 'right', 'bottom']);
const VALID_WHEN_CONDITIONS = /^\*$|^editorFocused$|^editorFocused:.+$/;
const VALID_ACTIVATION_EVENTS = /^onCommand:.+|^onDocumentType:.+|^onUri:.+|^onSetting:.+|^onStartup$|^\*$/;

/**
 * Reads and validates the `bifrostStudio` section from a parsed `package.json`.
 *
 * Returns a `ManifestReadResult` with:
 * - `manifest`: the typed manifest object, or `null` if no `bifrostStudio` section exists
 * - `errors`: structural problems that prevent the plugin from loading
 * - `warnings`: cosmetic issues that allow normal loading
 */
export function readManifest(pkg: Record<string, unknown>): ManifestReadResult {
  const raw = pkg.bifrostStudio;

  if (raw == null) {
    return { manifest: null, errors: [], warnings: [] };
  }

  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      manifest: null,
      errors: [{ path: 'bifrostStudio', message: 'Must be an object' }],
      warnings: [],
    };
  }

  const section = raw as Record<string, unknown>;
  const errors: ManifestError[] = [];
  const warnings: ManifestWarning[] = [];

  // --- apiVersion (required) ---
  if (section.apiVersion == null) {
    errors.push({ path: 'bifrostStudio.apiVersion', message: 'Required field is missing' });
  } else if (typeof section.apiVersion !== 'string' || section.apiVersion.trim().length === 0) {
    errors.push({ path: 'bifrostStudio.apiVersion', message: 'Must be a non-empty string' });
  }

  // --- optional top-level string fields ---
  if (section.displayName != null && typeof section.displayName !== 'string') {
    warnings.push({ path: 'bifrostStudio.displayName', message: 'Expected a string' });
  }
  if (section.displayName == null) {
    warnings.push({ path: 'bifrostStudio.displayName', message: 'Recommended field is missing' });
  }
  if (section.description != null && typeof section.description !== 'string') {
    warnings.push({ path: 'bifrostStudio.description', message: 'Expected a string' });
  }
  if (section.icon != null && typeof section.icon !== 'string') {
    warnings.push({ path: 'bifrostStudio.icon', message: 'Expected a string' });
  }

  // --- activationEvents ---
  let activationEvents: ActivationEvent[] | undefined;
  if (section.activationEvents != null) {
    if (!Array.isArray(section.activationEvents)) {
      errors.push({ path: 'bifrostStudio.activationEvents', message: 'Must be an array of strings' });
    } else {
      activationEvents = [];
      for (let i = 0; i < section.activationEvents.length; i++) {
        const event = section.activationEvents[i];
        if (typeof event !== 'string') {
          errors.push({
            path: `bifrostStudio.activationEvents[${i}]`,
            message: 'Must be a string',
          });
          continue;
        }
        if (!VALID_ACTIVATION_EVENTS.test(event)) {
          errors.push({
            path: `bifrostStudio.activationEvents[${i}]`,
            message: `Unknown activation event: "${event}"`,
          });
          continue;
        }
        activationEvents.push(event as ActivationEvent);
      }
    }
  }

  // --- permissions ---
  let permissions: PluginPermission[] | undefined;
  if (section.permissions != null) {
    if (!Array.isArray(section.permissions)) {
      errors.push({ path: 'bifrostStudio.permissions', message: 'Must be an array of permission strings' });
    } else {
      permissions = [];
      for (let i = 0; i < section.permissions.length; i++) {
        const perm = section.permissions[i];
        const permPath = `bifrostStudio.permissions[${i}]`;
        if (typeof perm !== 'string') {
          errors.push({ path: permPath, message: 'Must be a string' });
          continue;
        }
        if (RESERVED_PERMISSIONS.has(perm)) {
          errors.push({
            path: permPath,
            message: `"${perm}" is a reserved permission identifier with no v1 implementation`,
          });
          continue;
        }
        if (HARD_DENIED_PERMISSION_GROUPS.has(perm)) {
          errors.push({
            path: permPath,
            message: `"${perm}" refers to a hard-denied command group — these commands cannot be granted to plugins`,
          });
          continue;
        }
        if (!VALID_PERMISSIONS.has(perm)) {
          errors.push({ path: permPath, message: `Unknown permission: "${perm}"` });
          continue;
        }
        permissions.push(perm as PluginPermission);
      }

      if (permissions.length > 0) {
        if (permissions.includes('native') && !permissions.includes('filesystem')) {
          warnings.push({
            path: 'bifrostStudio.permissions',
            message: '"native" without "filesystem" is unusual — native addons typically need file access',
          });
        }
        if (permissions.includes('renderer-modules')) {
          warnings.push({
            path: 'bifrostStudio.permissions',
            message: '"renderer-modules" is a security-sensitive permission — it allows injecting code into the editor',
          });
        }
        if (permissions.includes('system-info')) {
          warnings.push({
            path: 'bifrostStudio.permissions',
            message: '"system-info" grants access to a restricted os module subset (platform, arch, tmpdir, EOL)',
          });
        }
      }
    }
  } else {
    warnings.push({
      path: 'bifrostStudio.permissions',
      message: 'No permissions declared — all gated capabilities will be denied',
    });
  }

  // --- contributes ---
  let contributes: ManifestContributions | undefined;
  if (section.contributes != null) {
    if (typeof section.contributes !== 'object' || Array.isArray(section.contributes)) {
      errors.push({ path: 'bifrostStudio.contributes', message: 'Must be an object' });
    } else {
      contributes = validateContributes(section.contributes as Record<string, unknown>, errors, warnings);
    }
  }

  // --- warn about unknown top-level fields ---
  const knownTopLevel = new Set([
    'apiVersion',
    'displayName',
    'description',
    'icon',
    'activationEvents',
    'permissions',
    'contributes',
  ]);
  for (const key of Object.keys(section)) {
    if (!knownTopLevel.has(key)) {
      warnings.push({ path: `bifrostStudio.${key}`, message: `Unknown field "${key}" (ignored)` });
    }
  }

  if (errors.length > 0) {
    return { manifest: null, errors, warnings };
  }

  const manifest: BifrostStudioManifest = {
    apiVersion: section.apiVersion as string,
    displayName: typeof section.displayName === 'string' ? section.displayName : undefined,
    description: typeof section.description === 'string' ? section.description : undefined,
    icon: typeof section.icon === 'string' ? section.icon : undefined,
    activationEvents,
    contributes,
    permissions,
  };

  // Cross-validate: bpmnPalette/bpmnContextPad require 'bpmn.modelling' permission
  const hasBpmnModellingPermission =
    permissions?.includes('bpmn.modelling') === true || permissions?.includes('bpmn.renderer') === true;
  if (!hasBpmnModellingPermission) {
    if (contributes?.bpmnPalette != null && contributes.bpmnPalette.length > 0) {
      warnings.push({
        path: 'bifrostStudio.contributes.bpmnPalette',
        message:
          'bpmnPalette contributions require the "bpmn.modelling" permission. ' +
          'These entries will be ignored at runtime until the permission is declared.',
      });
    }
    if (contributes?.bpmnContextPad != null && contributes.bpmnContextPad.length > 0) {
      warnings.push({
        path: 'bifrostStudio.contributes.bpmnContextPad',
        message:
          'bpmnContextPad contributions require the "bpmn.modelling" permission. ' +
          'These entries will be ignored at runtime until the permission is declared.',
      });
    }
  }

  return { manifest, errors, warnings };
}

// ─── Contributes validation ──────────────────────────────────

function validateContributes(
  raw: Record<string, unknown>,
  errors: ManifestError[],
  warnings: ManifestWarning[],
): ManifestContributions {
  const result: ManifestContributions = {};

  if (raw.commands != null) {
    result.commands = validateCommands(raw.commands, errors);
  }
  if (raw.menus != null) {
    result.menus = validateMenus(raw.menus, errors);
  }
  if (raw.settings != null) {
    result.settings = validateSettings(raw.settings, errors);
  }
  if (raw.keybindings != null) {
    result.keybindings = validateKeybindings(raw.keybindings, errors, warnings);
  }
  if (raw.icons != null) {
    result.icons = validateIcons(raw.icons, errors);
  }
  if (raw.panes != null) {
    result.panes = validatePanes(raw.panes, errors);
  }
  if (raw.serviceTaskTypes != null) {
    result.serviceTaskTypes = validateServiceTaskTypes(raw.serviceTaskTypes, errors);
  }
  if (raw.paneToggles != null) {
    result.paneToggles = validatePaneToggles(raw.paneToggles, errors);
  }
  if (raw.themes != null) {
    result.themes = validateThemes(raw.themes, errors);
  }
  if (raw.bpmnPalette != null) {
    result.bpmnPalette = validateBpmnPalette(raw.bpmnPalette, errors);
  }
  if (raw.bpmnContextPad != null) {
    result.bpmnContextPad = validateBpmnContextPad(raw.bpmnContextPad, errors);
  }

  const knownContributes = new Set([
    'commands',
    'menus',
    'settings',
    'keybindings',
    'icons',
    'panes',
    'serviceTaskTypes',
    'paneToggles',
    'themes',
    'bpmnPalette',
    'bpmnContextPad',
  ]);
  for (const key of Object.keys(raw)) {
    if (!knownContributes.has(key)) {
      warnings.push({
        path: `bifrostStudio.contributes.${key}`,
        message: `Unknown contribution type "${key}" (ignored)`,
      });
    }
  }

  return result;
}

// ─── Commands ────────────────────────────────────────────────

function validateCommands(raw: unknown, errors: ManifestError[]): ManifestCommand[] {
  const basePath = 'bifrostStudio.contributes.commands';
  if (!Array.isArray(raw)) {
    errors.push({ path: basePath, message: 'Must be an array' });
    return [];
  }

  const result: ManifestCommand[] = [];
  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    const entryPath = `${basePath}[${i}]`;

    if (typeof entry !== 'object' || entry == null || Array.isArray(entry)) {
      errors.push({ path: entryPath, message: 'Must be an object' });
      continue;
    }

    const obj = entry as Record<string, unknown>;
    if (typeof obj.id !== 'string' || obj.id.trim().length === 0) {
      errors.push({ path: `${entryPath}.id`, message: 'Required field "id" is missing or not a string' });
      continue;
    }
    if (typeof obj.title !== 'string' || obj.title.trim().length === 0) {
      errors.push({ path: `${entryPath}.title`, message: 'Required field "title" is missing or not a string' });
      continue;
    }

    result.push({
      id: obj.id,
      title: obj.title,
      icon: typeof obj.icon === 'string' ? obj.icon : undefined,
      category: typeof obj.category === 'string' ? obj.category : undefined,
    });
  }
  return result;
}

// ─── Menus ───────────────────────────────────────────────────

function validateMenus(raw: unknown, errors: ManifestError[]): Record<string, ManifestMenuItem[]> {
  const basePath = 'bifrostStudio.contributes.menus';
  if (typeof raw !== 'object' || raw == null || Array.isArray(raw)) {
    errors.push({ path: basePath, message: 'Must be an object mapping menu IDs to arrays of menu items' });
    return {};
  }

  const result: Record<string, ManifestMenuItem[]> = {};
  for (const [menuId, items] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(items)) {
      errors.push({ path: `${basePath}["${menuId}"]`, message: 'Must be an array of menu items' });
      continue;
    }

    const validItems: ManifestMenuItem[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemPath = `${basePath}["${menuId}"][${i}]`;

      if (typeof item !== 'object' || item == null || Array.isArray(item)) {
        errors.push({ path: itemPath, message: 'Must be an object' });
        continue;
      }

      const obj = item as Record<string, unknown>;
      if (typeof obj.command !== 'string' || obj.command.trim().length === 0) {
        errors.push({ path: `${itemPath}.command`, message: 'Required field "command" is missing or not a string' });
        continue;
      }

      validItems.push({
        command: obj.command,
        group: typeof obj.group === 'string' ? obj.group : undefined,
        when: typeof obj.when === 'string' ? obj.when : undefined,
      });
    }
    result[menuId] = validItems;
  }
  return result;
}

// ─── Settings ────────────────────────────────────────────────

function validateSettings(raw: unknown, errors: ManifestError[]): ManifestSetting[] {
  const basePath = 'bifrostStudio.contributes.settings';
  if (!Array.isArray(raw)) {
    errors.push({ path: basePath, message: 'Must be an array' });
    return [];
  }

  const result: ManifestSetting[] = [];
  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    const entryPath = `${basePath}[${i}]`;

    if (typeof entry !== 'object' || entry == null || Array.isArray(entry)) {
      errors.push({ path: entryPath, message: 'Must be an object' });
      continue;
    }

    const obj = entry as Record<string, unknown>;
    if (typeof obj.key !== 'string' || obj.key.trim().length === 0) {
      errors.push({ path: `${entryPath}.key`, message: 'Required field "key" is missing or not a string' });
      continue;
    }
    if (typeof obj.type !== 'string' || !VALID_SETTING_TYPES.has(obj.type)) {
      errors.push({
        path: `${entryPath}.type`,
        message: `Required field "type" must be one of: ${[...VALID_SETTING_TYPES].join(', ')}`,
      });
      continue;
    }

    result.push({
      key: obj.key,
      type: obj.type as ManifestSetting['type'],
      default: obj.default,
      description: typeof obj.description === 'string' ? obj.description : undefined,
      category: typeof obj.category === 'string' ? obj.category : undefined,
      enum: Array.isArray(obj.enum) ? obj.enum : undefined,
    });
  }
  return result;
}

// ─── Keybindings ─────────────────────────────────────────────

function validateKeybindings(raw: unknown, errors: ManifestError[], warnings: ManifestWarning[]): ManifestKeybinding[] {
  const basePath = 'bifrostStudio.contributes.keybindings';
  if (!Array.isArray(raw)) {
    errors.push({ path: basePath, message: 'Must be an array' });
    return [];
  }

  const result: ManifestKeybinding[] = [];
  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    const entryPath = `${basePath}[${i}]`;

    if (typeof entry !== 'object' || entry == null || Array.isArray(entry)) {
      errors.push({ path: entryPath, message: 'Must be an object' });
      continue;
    }

    const obj = entry as Record<string, unknown>;
    if (typeof obj.command !== 'string' || obj.command.trim().length === 0) {
      errors.push({ path: `${entryPath}.command`, message: 'Required field "command" is missing or not a string' });
      continue;
    }
    if (typeof obj.key !== 'string' || obj.key.trim().length === 0) {
      errors.push({ path: `${entryPath}.key`, message: 'Required field "key" is missing or not a string' });
      continue;
    }

    if (obj.when != null) {
      const when = String(obj.when);
      if (!VALID_WHEN_CONDITIONS.test(when)) {
        errors.push({
          path: `${entryPath}.when`,
          message: `Unknown "when" condition: "${when}". Valid values: "*", "editorFocused", "editorFocused:<documentType>"`,
        });
        continue;
      }
    }

    result.push({
      command: obj.command,
      key: obj.key,
      mac: typeof obj.mac === 'string' ? obj.mac : undefined,
      linux: typeof obj.linux === 'string' ? obj.linux : undefined,
      windows: typeof obj.windows === 'string' ? obj.windows : undefined,
      when: (obj.when as KeybindingWhenCondition) ?? undefined,
    });
  }
  return result;
}

// ─── Icons ───────────────────────────────────────────────────

function validateIcons(raw: unknown, errors: ManifestError[]): Record<string, string> {
  const basePath = 'bifrostStudio.contributes.icons';
  if (typeof raw !== 'object' || raw == null || Array.isArray(raw)) {
    errors.push({
      path: basePath,
      message: 'Must be an object mapping icon IDs to file paths or Phosphor class strings',
    });
    return {};
  }

  const result: Record<string, string> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== 'string') {
      errors.push({
        path: `${basePath}["${id}"]`,
        message: 'Icon value must be a string (file path or Phosphor class)',
      });
      continue;
    }
    result[id] = value;
  }
  return result;
}

// ─── Panes ───────────────────────────────────────────────────

function validatePanes(raw: unknown, errors: ManifestError[]): ManifestPaneContribution[] {
  const basePath = 'bifrostStudio.contributes.panes';
  if (!Array.isArray(raw)) {
    errors.push({ path: basePath, message: 'Must be an array' });
    return [];
  }

  const result: ManifestPaneContribution[] = [];
  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    const entryPath = `${basePath}[${i}]`;

    if (typeof entry !== 'object' || entry == null || Array.isArray(entry)) {
      errors.push({ path: entryPath, message: 'Must be an object' });
      continue;
    }

    const obj = entry as Record<string, unknown>;
    if (typeof obj.id !== 'string' || obj.id.trim().length === 0) {
      errors.push({ path: `${entryPath}.id`, message: 'Required field "id" is missing or not a string' });
      continue;
    }
    if (typeof obj.title !== 'string' || obj.title.trim().length === 0) {
      errors.push({ path: `${entryPath}.title`, message: 'Required field "title" is missing or not a string' });
      continue;
    }
    if (typeof obj.area !== 'string' || !VALID_PANE_AREAS.has(obj.area)) {
      errors.push({
        path: `${entryPath}.area`,
        message: `Required field "area" must be one of: ${[...VALID_PANE_AREAS].join(', ')}`,
      });
      continue;
    }

    let visibleWhen: ManifestPaneContribution['visibleWhen'];
    if (obj.visibleWhen != null) {
      if (typeof obj.visibleWhen !== 'object' || Array.isArray(obj.visibleWhen)) {
        errors.push({ path: `${entryPath}.visibleWhen`, message: 'Must be an object' });
        continue;
      }
      const vw = obj.visibleWhen as Record<string, unknown>;
      visibleWhen = {
        documentType: typeof vw.documentType === 'string' ? vw.documentType : undefined,
        setting: typeof vw.setting === 'string' ? vw.setting : undefined,
      };
    }

    result.push({
      id: obj.id,
      title: obj.title,
      area: obj.area as ManifestPaneContribution['area'],
      groupId: typeof obj.groupId === 'string' ? obj.groupId : undefined,
      icon: typeof obj.icon === 'string' ? obj.icon : undefined,
      visibleWhen,
    });
  }
  return result;
}

// ─── Service Task Types ──────────────────────────────────────

function validateServiceTaskTypes(raw: unknown, errors: ManifestError[]): ManifestServiceTaskType[] {
  const basePath = 'bifrostStudio.contributes.serviceTaskTypes';
  if (!Array.isArray(raw)) {
    errors.push({ path: basePath, message: 'Must be an array' });
    return [];
  }

  const result: ManifestServiceTaskType[] = [];
  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    const entryPath = `${basePath}[${i}]`;

    if (typeof entry !== 'object' || entry == null || Array.isArray(entry)) {
      errors.push({ path: entryPath, message: 'Must be an object' });
      continue;
    }

    const obj = entry as Record<string, unknown>;
    if (typeof obj.implementation !== 'string' || obj.implementation.trim().length === 0) {
      errors.push({
        path: `${entryPath}.implementation`,
        message: 'Required field "implementation" is missing or not a string',
      });
      continue;
    }
    if (typeof obj.label !== 'string' || obj.label.trim().length === 0) {
      errors.push({ path: `${entryPath}.label`, message: 'Required field "label" is missing or not a string' });
      continue;
    }

    result.push({
      implementation: obj.implementation,
      label: obj.label,
    });
  }
  return result;
}

// ─── Pane Toggles ────────────────────────────────────────────

const VALID_TOGGLE_AREAS = new Set(['left', 'right', 'bottom']);

function validatePaneToggles(raw: unknown, errors: ManifestError[]): ManifestPaneToggle[] {
  const basePath = 'bifrostStudio.contributes.paneToggles';
  if (!Array.isArray(raw)) {
    errors.push({ path: basePath, message: 'Must be an array' });
    return [];
  }

  const result: ManifestPaneToggle[] = [];
  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    const entryPath = `${basePath}[${i}]`;

    if (typeof entry !== 'object' || entry == null || Array.isArray(entry)) {
      errors.push({ path: entryPath, message: 'Must be an object' });
      continue;
    }

    const obj = entry as Record<string, unknown>;
    if (typeof obj.id !== 'string' || obj.id.trim().length === 0) {
      errors.push({ path: `${entryPath}.id`, message: 'Required field "id" is missing or not a string' });
      continue;
    }
    if (typeof obj.icon !== 'string' || obj.icon.trim().length === 0) {
      errors.push({ path: `${entryPath}.icon`, message: 'Required field "icon" is missing or not a string' });
      continue;
    }
    if (typeof obj.tooltip !== 'string' || obj.tooltip.trim().length === 0) {
      errors.push({ path: `${entryPath}.tooltip`, message: 'Required field "tooltip" is missing or not a string' });
      continue;
    }
    if (typeof obj.paneAreaId !== 'string' || !VALID_TOGGLE_AREAS.has(obj.paneAreaId)) {
      errors.push({
        path: `${entryPath}.paneAreaId`,
        message: `Required field "paneAreaId" must be one of: ${[...VALID_TOGGLE_AREAS].join(', ')}`,
      });
      continue;
    }
    if (typeof obj.paneId !== 'string' || obj.paneId.trim().length === 0) {
      errors.push({ path: `${entryPath}.paneId`, message: 'Required field "paneId" is missing or not a string' });
      continue;
    }

    result.push({
      id: obj.id,
      icon: obj.icon,
      tooltip: obj.tooltip,
      paneAreaId: obj.paneAreaId as ManifestPaneToggle['paneAreaId'],
      paneId: obj.paneId,
      insertAfter: typeof obj.insertAfter === 'string' ? obj.insertAfter : undefined,
      insertBefore: typeof obj.insertBefore === 'string' ? obj.insertBefore : undefined,
    });
  }
  return result;
}

// ─── Themes ──────────────────────────────────────────────────

const VALID_THEME_TYPES = new Set(['dark', 'light']);

function validateThemes(raw: unknown, errors: ManifestError[]): ManifestTheme[] {
  const basePath = 'bifrostStudio.contributes.themes';
  if (!Array.isArray(raw)) {
    errors.push({ path: basePath, message: 'Must be an array' });
    return [];
  }

  const result: ManifestTheme[] = [];
  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    const entryPath = `${basePath}[${i}]`;

    if (typeof entry !== 'object' || entry == null || Array.isArray(entry)) {
      errors.push({ path: entryPath, message: 'Must be an object' });
      continue;
    }

    const obj = entry as Record<string, unknown>;
    if (typeof obj.id !== 'string' || obj.id.trim().length === 0) {
      errors.push({ path: `${entryPath}.id`, message: 'Required field "id" is missing or not a string' });
      continue;
    }
    if (typeof obj.label !== 'string' || obj.label.trim().length === 0) {
      errors.push({ path: `${entryPath}.label`, message: 'Required field "label" is missing or not a string' });
      continue;
    }
    if (typeof obj.type !== 'string' || !VALID_THEME_TYPES.has(obj.type)) {
      errors.push({
        path: `${entryPath}.type`,
        message: `Required field "type" must be one of: ${[...VALID_THEME_TYPES].join(', ')}`,
      });
      continue;
    }
    if (typeof obj.tokens !== 'object' || obj.tokens == null || Array.isArray(obj.tokens)) {
      errors.push({ path: `${entryPath}.tokens`, message: 'Required field "tokens" must be an object' });
      continue;
    }

    const tokens: Record<string, string> = {};
    let tokensValid = true;
    for (const [key, value] of Object.entries(obj.tokens as Record<string, unknown>)) {
      if (typeof value !== 'string') {
        errors.push({
          path: `${entryPath}.tokens["${key}"]`,
          message: 'Token value must be a string',
        });
        tokensValid = false;
        break;
      }
      tokens[key] = value;
    }
    if (!tokensValid) {
      continue;
    }

    result.push({
      id: obj.id,
      label: obj.label,
      type: obj.type as ManifestTheme['type'],
      tokens,
    });
  }
  return result;
}

// ─── BPMN Palette ────────────────────────────────────────────

function validateBpmnPalette(raw: unknown, errors: ManifestError[]): ManifestBpmnPaletteEntry[] {
  const basePath = 'bifrostStudio.contributes.bpmnPalette';
  if (!Array.isArray(raw)) {
    errors.push({ path: basePath, message: 'Must be an array' });
    return [];
  }

  const result: ManifestBpmnPaletteEntry[] = [];
  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    const entryPath = `${basePath}[${i}]`;

    if (typeof entry !== 'object' || entry == null || Array.isArray(entry)) {
      errors.push({ path: entryPath, message: 'Must be an object' });
      continue;
    }

    const obj = entry as Record<string, unknown>;
    let valid = true;

    for (const field of ['id', 'icon', 'title', 'command'] as const) {
      if (typeof obj[field] !== 'string' || (obj[field] as string).trim().length === 0) {
        errors.push({
          path: `${entryPath}.${field}`,
          message: `Required field "${field}" is missing or not a non-empty string`,
        });
        valid = false;
      }
    }
    if (!valid) {
      continue;
    }

    result.push({
      id: obj.id as string,
      group: typeof obj.group === 'string' ? obj.group : undefined,
      icon: obj.icon as string,
      title: obj.title as string,
      command: obj.command as string,
    });
  }
  return result;
}

// ─── BPMN Context Pad ────────────────────────────────────────

function validateBpmnContextPad(raw: unknown, errors: ManifestError[]): ManifestBpmnContextPadEntry[] {
  const basePath = 'bifrostStudio.contributes.bpmnContextPad';
  if (!Array.isArray(raw)) {
    errors.push({ path: basePath, message: 'Must be an array' });
    return [];
  }

  const result: ManifestBpmnContextPadEntry[] = [];
  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    const entryPath = `${basePath}[${i}]`;

    if (typeof entry !== 'object' || entry == null || Array.isArray(entry)) {
      errors.push({ path: entryPath, message: 'Must be an object' });
      continue;
    }

    const obj = entry as Record<string, unknown>;
    let valid = true;

    for (const field of ['id', 'icon', 'title', 'command'] as const) {
      if (typeof obj[field] !== 'string' || (obj[field] as string).trim().length === 0) {
        errors.push({
          path: `${entryPath}.${field}`,
          message: `Required field "${field}" is missing or not a non-empty string`,
        });
        valid = false;
      }
    }
    if (!valid) {
      continue;
    }

    if (obj.elementTypes != null) {
      if (!Array.isArray(obj.elementTypes) || obj.elementTypes.length === 0) {
        errors.push({
          path: `${entryPath}.elementTypes`,
          message: '"elementTypes" must be a non-empty array of strings when present',
        });
        continue;
      }
      const allStrings = obj.elementTypes.every((item: unknown) => typeof item === 'string');
      if (!allStrings) {
        errors.push({
          path: `${entryPath}.elementTypes`,
          message: 'All items in "elementTypes" must be strings',
        });
        continue;
      }
    }

    result.push({
      id: obj.id as string,
      icon: obj.icon as string,
      title: obj.title as string,
      command: obj.command as string,
      elementTypes: obj.elementTypes as string[] | undefined,
    });
  }
  return result;
}
