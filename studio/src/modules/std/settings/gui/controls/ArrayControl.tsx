import React, { useState } from 'react';

import type { SettingArrayItemsDescriptor } from '@evil/bifrost_fw_sdk';

import { ColorControl } from './ColorControl';
import { DateControl } from './DateControl';
import { ObjectArrayItemsControl } from './ObjectArrayItemsControl';

type ArrayControlProps = {
  value: unknown[];
  itemsDescriptor?: SettingArrayItemsDescriptor;
  onChange: (value: unknown[]) => void;
  onOpenJsonEditor: () => void;
};

const GUI_ARRAY_ITEM_TYPES = ['string', 'color', 'date'] as const;

function usesPrimitiveStringListGui(
  itemsDescriptor: SettingArrayItemsDescriptor | undefined,
  value: unknown[],
): boolean {
  if (itemsDescriptor != null) {
    if (itemsDescriptor.type === 'object') {
      return false;
    }
    return (GUI_ARRAY_ITEM_TYPES as readonly string[]).includes(itemsDescriptor.type);
  }
  // Without an `items` schema, only treat as a string list when non-empty and all strings.
  return value.length > 0 && value.every((item) => typeof item === 'string');
}

export function ArrayControl(props: ArrayControlProps): React.JSX.Element {
  const [newItem, setNewItem] = useState(() => {
    if (props.itemsDescriptor != null && props.itemsDescriptor.type === 'color') {
      return '#808080';
    }
    return '';
  });

  if (props.itemsDescriptor?.type === 'object') {
    return (
      <ObjectArrayItemsControl
        properties={props.itemsDescriptor.properties}
        value={props.value}
        onChange={props.onChange}
      />
    );
  }

  const primitiveItemType = props.itemsDescriptor?.type;

  const usePrimitiveGui = usesPrimitiveStringListGui(props.itemsDescriptor, props.value);

  if (!usePrimitiveGui) {
    return (
      <button className="btn btn-sm btn-outline-secondary" onClick={props.onOpenJsonEditor}>
        Edit in JSON
      </button>
    );
  }

  const items = props.value as string[];

  const removeItem = (index: number): void => {
    const updated = [...items];
    updated.splice(index, 1);
    props.onChange(updated);
  };

  const addItem = (): void => {
    const trimmed = newItem.trim();
    if (trimmed === '') {
      return;
    }
    props.onChange([...items, trimmed]);
    setNewItem(primitiveItemType === 'color' ? '#808080' : '');
  };

  function renderItemEditor(item: string, index: number): React.JSX.Element {
    const updateAt = (next: string): void => {
      const updated = [...items];
      updated[index] = next;
      props.onChange(updated);
    };

    if (primitiveItemType === 'color') {
      return <ColorControl value={item} onChange={updateAt} />;
    }
    if (primitiveItemType === 'date') {
      return <DateControl value={item} onChange={updateAt} />;
    }
    return (
      <input
        type="text"
        className="form-control form-control-sm flex-grow-1"
        value={item}
        onChange={(e) => updateAt(e.target.value)}
      />
    );
  }

  function renderNewItemEditor(): React.JSX.Element {
    if (primitiveItemType === 'color') {
      return <ColorControl value={newItem} onChange={setNewItem} />;
    }
    if (primitiveItemType === 'date') {
      return <DateControl value={newItem} onChange={setNewItem} />;
    }
    return (
      <input
        type="text"
        className="form-control form-control-sm flex-grow-1"
        value={newItem}
        placeholder="Add new item..."
        onChange={(e) => setNewItem(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            addItem();
          }
        }}
      />
    );
  }

  return (
    <div style={{ maxWidth: 400 }}>
      {items.map((item, index) => (
        <div key={index} className="d-flex align-items-center mb-1">
          <div className="flex-grow-1 mr-2">{renderItemEditor(item, index)}</div>
          <button className="btn btn-sm btn-outline-danger ml-1" onClick={() => removeItem(index)} title="Remove">
            &times;
          </button>
        </div>
      ))}
      <div className="d-flex align-items-center mt-1">
        <div className="flex-grow-1 mr-2">{renderNewItemEditor()}</div>
        <button className="btn btn-sm btn-outline-primary ml-1" onClick={addItem} title="Add" type="button">
          +
        </button>
      </div>
    </div>
  );
}
