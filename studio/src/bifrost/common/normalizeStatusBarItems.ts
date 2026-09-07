import type {
  StatusBarContent,
  StatusBarItem,
  StatusBarItem_Button,
  StatusBarItem_Menu,
} from '../contracts/StatusBarTypes';

const STATUS_BAR_ITEM_TYPES = new Set(['button', 'divider', 'menu']);

/**
 * Factories must return `StatusBarItem[]`. `Array.concat` also flattens array-like
 * objects (`{ 0: ..., length: n }`), so a mistaken number/flag map becomes many
 * bare `0`/`1` cells in the bar. Drop anything that is not a real item.
 */
export function normalizeStatusBarItems(raw: unknown): StatusBarItem[] {
  const candidates = toCandidateList(raw);
  const seenIds = new Set<string>();
  const items: StatusBarItem[] = [];

  for (const candidate of candidates) {
    const item = normalizeStatusBarItem(candidate);
    if (item == null) {
      continue;
    }
    if (seenIds.has(item.id)) {
      continue;
    }
    seenIds.add(item.id);
    items.push(item);
  }

  return items;
}

function toCandidateList(raw: unknown): unknown[] {
  if (raw == null) {
    return [];
  }
  if (Array.isArray(raw)) {
    return raw;
  }
  return [raw];
}

function normalizeStatusBarItem(value: unknown): StatusBarItem | null {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as { type?: unknown; id?: unknown; content?: unknown };
  if (typeof candidate.id !== 'string' || candidate.id === '') {
    return null;
  }
  if (typeof candidate.type !== 'string' || !STATUS_BAR_ITEM_TYPES.has(candidate.type)) {
    return null;
  }

  if (candidate.type === 'divider') {
    return candidate as StatusBarItem;
  }

  const content = normalizeStatusBarContent(candidate.content);
  if (content == null) {
    return null;
  }

  return { ...(candidate as StatusBarItem_Button | StatusBarItem_Menu), content };
}

function normalizeStatusBarContent(content: unknown): StatusBarContent | null {
  if (typeof content === 'string') {
    return { type: 'text', label: content };
  }

  if (Array.isArray(content)) {
    const pieces = content
      .map((piece) => {
        if (typeof piece === 'string') {
          return { type: 'text' as const, label: piece };
        }
        return normalizeStatusBarContentObject(piece);
      })
      .filter((piece): piece is Exclude<StatusBarContent, StatusBarContent[]> => piece != null);
    if (pieces.length === 0) {
      return null;
    }
    if (pieces.length === 1) {
      return pieces[0];
    }
    return pieces;
  }

  return normalizeStatusBarContentObject(content);
}

function normalizeStatusBarContentObject(value: unknown): Exclude<StatusBarContent, StatusBarContent[]> | null {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as { type?: unknown; icon?: unknown; label?: unknown };
  if (candidate.type === 'icon' && typeof candidate.icon === 'string' && candidate.icon !== '') {
    return { type: 'icon', icon: candidate.icon };
  }
  if (candidate.type === 'text') {
    if (typeof candidate.label === 'string') {
      return { type: 'text', label: candidate.label };
    }
    if (typeof candidate.label === 'number' && Number.isFinite(candidate.label)) {
      return { type: 'text', label: String(candidate.label) };
    }
  }

  return null;
}
