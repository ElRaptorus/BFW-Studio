import type { FormFieldDefinition } from '#modules/bpmn-editor/BpmnElementTypes';
import { useDrag, useDrop } from 'react-dnd';

import React, { useCallback, useRef } from 'react';

import './FormCanvas.scss';
import { FormCanvasItem } from './FormCanvasItem';
import type { FormBuilderState } from './useBpmnFormBuilderState';

const DRAG_TYPE = 'FORM_FIELD';

type DragItem = {
  index: number;
  id: string;
};

type FormCanvasProps = {
  state: FormBuilderState;
};

export function FormCanvas(props: FormCanvasProps): React.JSX.Element {
  const { state } = props;
  const { fields, selectedFieldId, selectField, setFields } = state;

  const moveField = useCallback(
    (dragIndex: number, hoverIndex: number) => {
      const reordered = [...fields];
      const [removed] = reordered.splice(dragIndex, 1);
      reordered.splice(hoverIndex, 0, removed);
      setFields(reordered);
    },
    [fields, setFields],
  );

  const removeField = useCallback(
    (fieldId: string) => {
      const filtered = fields.filter((field) => field.id !== fieldId);
      setFields(filtered);
      if (selectedFieldId === fieldId) {
        selectField(null);
      }
    },
    [fields, setFields, selectedFieldId, selectField],
  );

  return (
    <div className="form-canvas">
      {fields.length === 0 && (
        <div className="form-canvas__empty">
          <i className="ph ph-plus-circle" />
          <p>Click a field type in the toolbox to add fields</p>
        </div>
      )}
      {fields.map((field, index) => (
        <DraggableFieldItem
          key={field.id}
          field={field}
          index={index}
          isSelected={selectedFieldId === field.id}
          onSelect={() => selectField(field.id)}
          onRemove={() => removeField(field.id)}
          onMove={moveField}
        />
      ))}
    </div>
  );
}

type DraggableFieldItemProps = {
  field: FormFieldDefinition;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onMove: (dragIndex: number, hoverIndex: number) => void;
};

function DraggableFieldItem(props: DraggableFieldItemProps): React.JSX.Element {
  const { field, index, isSelected, onSelect, onRemove, onMove } = props;

  const [{ isDragging }, drag] = useDrag({
    type: DRAG_TYPE,
    item: (): DragItem => ({ id: field.id, index }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop<DragItem>({
    accept: DRAG_TYPE,
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
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (clientOffset == null) {
        return;
      }
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;

      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
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
      data-test--form-canvas-item
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <FormCanvasItem field={field} index={index} isSelected={isSelected} onSelect={onSelect} onRemove={onRemove} />
    </div>
  );
}
