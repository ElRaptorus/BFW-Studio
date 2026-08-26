import type { FormAction } from '#modules/bpmn-editor/BpmnElementTypes';
import { useDrag, useDrop } from 'react-dnd';

import React, { useCallback, useRef } from 'react';

import './ActionsEditor.scss';
import type { FormBuilderState } from './useBpmnFormBuilderState';

const DRAG_TYPE_ACTION = 'FORM_ACTION';

type ActionDragItem = {
  index: number;
  id: string;
};

type ActionsEditorProps = {
  state: FormBuilderState;
};

export function ActionsEditor(props: ActionsEditorProps): React.JSX.Element {
  const { state } = props;
  const { actions, selectedActionId, setActions, selectAction } = state;

  const moveAction = useCallback(
    (dragIndex: number, hoverIndex: number) => {
      const reordered = [...actions];
      const [removed] = reordered.splice(dragIndex, 1);
      reordered.splice(hoverIndex, 0, removed);
      setActions(reordered);
    },
    [actions, setActions],
  );

  const handleRemoveAction = useCallback(
    (actionId: string): void => {
      const filtered = actions.filter((action) => action.id !== actionId);
      setActions(filtered);
      if (selectedActionId === actionId) {
        selectAction(null);
      }
    },
    [actions, setActions, selectedActionId, selectAction],
  );

  return (
    <div className="actions-editor">
      <div className="actions-editor__header">
        <h4 className="actions-editor__heading">Actions</h4>
      </div>
      <div className="actions-editor__list">
        {actions.length === 0 && (
          <span className="actions-editor__empty">No actions (default OK button will be shown)</span>
        )}
        {actions.map((action, index) => (
          <DraggableActionItem
            key={action.id}
            action={action}
            index={index}
            isSelected={selectedActionId === action.id}
            onSelect={() => selectAction(action.id)}
            onRemove={() => handleRemoveAction(action.id)}
            onMove={moveAction}
          />
        ))}
      </div>
    </div>
  );
}

type DraggableActionItemProps = {
  action: FormAction;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onMove: (dragIndex: number, hoverIndex: number) => void;
};

function DraggableActionItem(props: DraggableActionItemProps): React.JSX.Element {
  const { action, index, isSelected, onSelect, onRemove, onMove } = props;

  const [{ isDragging }, drag] = useDrag({
    type: DRAG_TYPE_ACTION,
    item: (): ActionDragItem => ({ id: action.id, index }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop<ActionDragItem>({
    accept: DRAG_TYPE_ACTION,
    hover(item, monitor) {
      if (elementRef.current == null) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = index;

      if (dragIndex === hoverIndex) {
        return;
      }

      const hoverBoundingRect = elementRef.current.getBoundingClientRect();
      const hoverMiddleX = (hoverBoundingRect.right - hoverBoundingRect.left) / 2;
      const clientOffset = monitor.getClientOffset();
      if (clientOffset == null) {
        return;
      }
      const hoverClientX = clientOffset.x - hoverBoundingRect.left;

      if (dragIndex < hoverIndex && hoverClientX < hoverMiddleX) {
        return;
      }
      if (dragIndex > hoverIndex && hoverClientX > hoverMiddleX) {
        return;
      }

      onMove(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  const elementRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={(node) => {
        drag(drop(node));
        (elementRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      className={`actions-editor__item${isSelected ? ' actions-editor__item--selected' : ''}`}
      data-test--actions-editor-item
      style={{ opacity: isDragging ? 0.4 : 1, cursor: 'grab' }}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          onSelect();
        }
      }}
    >
      <ActionBadge action={action} />
      <span className="actions-editor__item-label">{action.label}</span>
      <span className="actions-editor__item-preset">{action.preset}</span>
      <button
        type="button"
        className="actions-editor__item-remove"
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
      >
        <i className="ph ph-x" />
      </button>
    </div>
  );
}

function ActionBadge(props: { action: FormAction }): React.JSX.Element {
  const { action } = props;
  let className = 'actions-editor__badge';
  if (action.isDefault) {
    className += ' actions-editor__badge--primary';
  }
  if (action.isDanger) {
    className += ' actions-editor__badge--danger';
  }
  return <span className={className} />;
}
