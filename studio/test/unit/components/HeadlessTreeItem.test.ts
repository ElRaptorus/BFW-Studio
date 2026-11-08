/**
 * @vitest-environment jsdom
 */
import type { Bifrost } from '#bifrost/Bifrost';
import type { IconComponent } from '#bifrost/contracts/IconTypes';
import { HeadlessTreeItem } from '#components/Tree/HeadlessTreeItem';
import type { TreeItemData } from '#components/Tree/TreeDataAdapter';
import type { ItemInstance } from '@headless-tree/core';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import React, { act } from 'react';

function mockIcon(_props: { id: string }): React.JSX.Element {
  return React.createElement('span', { className: 'mock-icon' });
}
mockIcon.registerIcon = () => undefined;
const iconComponent = mockIcon as IconComponent;

function createItemInstance(itemData: TreeItemData, expandable: boolean): ItemInstance<TreeItemData> {
  const props: Record<string, unknown> = {
    onClick: vi.fn(),
    onDoubleClick: vi.fn(),
    'aria-selected': false,
  };
  return {
    getItemData: () => itemData,
    getItemMeta: () => ({ level: 1 }),
    isFolder: () => expandable,
    getProps: () => ({ ref: vi.fn(), ...props }),
  } as unknown as ItemInstance<TreeItemData>;
}

const studio = {} as Bifrost;

describe('HeadlessTreeItem checkbox', () => {
  it('renders no checkbox when checkboxState is unset', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const baseData: TreeItemData = {
      htId: 'process-a',
      type: 'file',
      label: 'Process A',
    };

    act(() => {
      root.render(
        React.createElement(HeadlessTreeItem, {
          item: createItemInstance(baseData, true),
          dataVersion: 0,
          isExpanded: false,
          isSelected: false,
          selectedCount: 0,
          studio,
          iconComponent,
          onContextMenu: vi.fn(),
        }),
      );
    });
    expect(container.querySelector('[data-test--tree-entry-checkbox]')).toBeNull();
    root.unmount();
  });

  it('renders a checkbox when checkboxState is set', () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(
        React.createElement(HeadlessTreeItem, {
          item: createItemInstance(
            { htId: 'process-a', type: 'file', label: 'Process A', checkboxState: 'unchecked' },
            true,
          ),
          dataVersion: 0,
          isExpanded: false,
          isSelected: false,
          selectedCount: 0,
          studio,
          iconComponent,
          onContextMenu: vi.fn(),
        }),
      );
    });
    expect(container.querySelector('[data-test--tree-entry-checkbox]')).not.toBeNull();
    root.unmount();
  });

  it('sets indeterminate for mixed state and reports checkbox clicks without selecting the row', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const itemData: TreeItemData = {
      htId: 'file-a',
      type: 'directory',
      label: 'orders.bpmn',
      checkboxState: 'mixed',
    };
    const item = createItemInstance(itemData, true);
    const onActionIconClick = vi.fn();

    act(() => {
      root.render(
        React.createElement(HeadlessTreeItem, {
          item,
          dataVersion: 0,
          isExpanded: true,
          isSelected: false,
          selectedCount: 0,
          studio,
          iconComponent,
          onContextMenu: vi.fn(),
          onActionIconClick,
        }),
      );
    });

    const checkbox = container.querySelector('[data-test--tree-entry-checkbox]') as HTMLInputElement;
    expect(checkbox.indeterminate).toBe(true);

    act(() => {
      checkbox.click();
    });
    expect(onActionIconClick).toHaveBeenCalledWith(
      expect.objectContaining({ actionId: 'checkbox', label: 'orders.bpmn' }),
      expect.objectContaining({ type: 'click' }),
    );
    expect(item.getProps().onClick).not.toHaveBeenCalled();
    root.unmount();
  });
});
