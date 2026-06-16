import { AbstractEmitter } from '@evil/bifrost_fw_sdk';

import type {
  QuickJumpItem,
  QuickJumpOpenEntryFn,
  QuickJumpOptions,
  QuickJumpViewData,
} from '../contracts/QuickJumpTypes';

export const EVENT_QUICK_JUMP_ENTRIES_CHANGED = 'EVENT_QUICK_JUMP_ENTRIES_CHANGED';
export const EVENT_QUICK_JUMP_SHOW = 'EVENT_QUICK_JUMP_SHOW';
export const EVENT_QUICK_JUMP_HIDE = 'EVENT_QUICK_JUMP_HIDE';

const DEFAULT_OPEN_ENTRY_FN = (item: QuickJumpItem, query: string): void => {
  throw new Error(
    `This QuickJumpView has no \`openEntryFn\` defined.\n\nQuery:\n\n${JSON.stringify(query)}` +
      `\n\nItem:\n\n${JSON.stringify(item, null, 2)}`,
  );
};

export class QuickJumpView extends AbstractEmitter {
  private allEntries: any[] = [];
  private filteredEntries: any[] = [];
  private initialInputValue: string = '';
  private selectedIndex: number = 0;
  private query: string = '';
  private visible: boolean = false;
  private openEntryFn: QuickJumpOpenEntryFn;
  private hideWithDelayTimeoutId: number | null = null;
  private prompt: string = '';

  constructor(openEntryFn?: QuickJumpOpenEntryFn) {
    super();

    this.openEntryFn = openEntryFn || DEFAULT_OPEN_ENTRY_FN;
  }

  openSelectedEntry(event?: any): void {
    const entry: QuickJumpItem = this.filteredEntries[this.selectedIndex];

    this.openEntry(entry, event);
  }

  openSelectedEntryAndClose(event?: any): void {
    this.hide();
    this.openSelectedEntry(event);
  }

  openEntry(item: QuickJumpItem, event?: any): void {
    this.openEntryFn.apply(null, [item, this.query, event]);
  }

  openEntryAndClose(item: QuickJumpItem, event?: any): void {
    this.hide();
    this.openEntry(item, event);
  }

  getEntries(): QuickJumpItem[] {
    return this.filteredEntries;
  }

  private setEntries(entries: QuickJumpItem[]): void {
    this.selectedIndex = 0;
    this.allEntries = entries;
    this.setQuery('');

    this.emit(EVENT_QUICK_JUMP_ENTRIES_CHANGED);
  }

  setQuery(query: string): void {
    this.query = query;
    this.filterEntries(query);
  }

  selectPreviousEntry(): void {
    let newSelectedIndex = this.selectedIndex - 1;
    if (newSelectedIndex < 0) {
      newSelectedIndex = this.filteredEntries.length - 1;
    }

    this.selectedIndex = newSelectedIndex;

    this.emit(EVENT_QUICK_JUMP_ENTRIES_CHANGED);
  }

  selectNextEntry(): void {
    let newSelectedIndex = this.selectedIndex + 1;
    if (newSelectedIndex >= this.filteredEntries.length) {
      newSelectedIndex = 0;
    }

    this.selectedIndex = newSelectedIndex;

    this.emit(EVENT_QUICK_JUMP_ENTRIES_CHANGED);
  }

  serialize(): QuickJumpViewData {
    return {
      visible: this.visible,
      prompt: this.prompt,
      initialInputValue: this.initialInputValue,
      allEntries: this.allEntries,
      filteredEntries: this.filteredEntries,
      selectedIndex: this.selectedIndex,
    };
  }

  show(options: QuickJumpOptions): void {
    if (this.hideWithDelayTimeoutId != null) {
      window.clearTimeout(this.hideWithDelayTimeoutId);
      this.hideWithDelayTimeoutId = null;
    }

    this.prompt = options.prompt || '';
    this.setEntries(options.entries);

    this.emit(EVENT_QUICK_JUMP_SHOW);

    this.initialInputValue = '';
    this.setQuery(this.initialInputValue);
    this.visible = true;

    this.emit(EVENT_QUICK_JUMP_ENTRIES_CHANGED);
  }

  hide(): void {
    this.emit(EVENT_QUICK_JUMP_HIDE);
    this.visible = false;

    this.emit(EVENT_QUICK_JUMP_ENTRIES_CHANGED);
  }

  hideWithDelay(): void {
    // We defer the closing of the quickjump since the 'blur' event
    // might originate from clicking on a entry using the mouse.
    // In this case, the 'blur' is fired and hides the quickjump
    // before the 'click' event can execute the clicked entry.
    // TODO: see if there is a better way ...

    this.hideWithDelayTimeoutId = window.setTimeout(() => this.hide(), 200);
  }

  private filterEntries(query: string): void {
    let filteredEntries: QuickJumpItem[] = [];

    if (query.trim() === '') {
      filteredEntries = [...this.allEntries];
    } else {
      const normalizedQuery = query.toLowerCase().trim();
      const normalizedQueryParts = normalizedQuery.split(/\s+/);

      this.allEntries.forEach((entry: QuickJumpItem) => {
        if (entry.sticky === true) {
          filteredEntries.push(this.highlightEntry(entry, normalizedQueryParts));
          return;
        }

        let lastFoundIndex = -1;
        const entryString = `${entry.label.toLowerCase()} ${entry.sublabel?.toLowerCase()}`;

        const matchesQuery = normalizedQueryParts.every((queryPart: string): boolean => {
          const foundIndex = entryString.indexOf(queryPart);

          if (foundIndex > lastFoundIndex) {
            lastFoundIndex = foundIndex;
            return true;
          }

          return false;
        });

        if (matchesQuery) {
          filteredEntries.push(this.highlightEntry(entry, normalizedQueryParts));
        }
      });
    }

    this.filteredEntries = filteredEntries;

    this.emit(EVENT_QUICK_JUMP_ENTRIES_CHANGED);
  }

  private highlightEntry(entry: QuickJumpItem, parts: string[]): QuickJumpItem {
    return { ...entry, labelHighlight: parts, sublabelHighlight: parts };
  }
}
