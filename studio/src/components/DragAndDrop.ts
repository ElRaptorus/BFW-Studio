import type React from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

/** Accept type that matches files dragged in from the operating system. */
export const DRAG_TYPE_FILES = 'files';

/** `item` is null for files; `files` is empty until the drop, because browsers hide dragged files before that. */
export type DragSubject = {
  type: string;
  item: any;
  files: File[];
};

type ActiveDrag = { type: string; item: any };

type DragSourceOptions = {
  type: string;
  getItem: () => any;
  canDrag?: boolean;
};

type DropTargetOptions = {
  accept: string[];
  canDrop?: (subject: DragSubject) => boolean;
  onHover?: (subject: DragSubject, event: React.DragEvent) => void;
  onDrop: (subject: DragSubject, event: React.DragEvent) => void;
};

// The DataTransfer payload cannot be read during dragover, so the dragged item lives here.
let activeDrag: ActiveDrag | null = null;
let claimedTargetId: symbol | null = null;
const claimListeners = new Set<() => void>();

function claimTarget(targetId: symbol | null): void {
  if (claimedTargetId === targetId) {
    return;
  }
  claimedTargetId = targetId;
  claimListeners.forEach((listener) => listener());
}

function releaseTarget(targetId: symbol): void {
  if (claimedTargetId === targetId) {
    claimTarget(null);
  }
}

function subscribeToClaims(listener: () => void): () => void {
  claimListeners.add(listener);
  return () => claimListeners.delete(listener);
}

// Drags from the operating system have no source dragend, so the claim is reset here.
if (typeof document !== 'undefined') {
  document.addEventListener('drop', () => claimTarget(null), true);
  document.addEventListener('dragend', () => claimTarget(null), true);
}

export function useDragSource(options: DragSourceOptions): {
  isDragging: boolean;
  dragSourceProps: Pick<React.HTMLAttributes<HTMLElement>, 'draggable' | 'onDragStart' | 'onDragEnd'>;
} {
  const optionsRef = useRef(options);
  useLayoutEffect(() => {
    optionsRef.current = options;
  });
  const [isDragging, setIsDragging] = useState(false);

  const onDragStart = useCallback((event: React.DragEvent) => {
    const { type, getItem, canDrag = true } = optionsRef.current;
    if (!canDrag) {
      event.preventDefault();
      return;
    }
    event.stopPropagation();
    activeDrag = { type, item: getItem() };
    event.dataTransfer.setData(`application/x-bfw-${type}`, '');
    event.dataTransfer.effectAllowed = 'copyMove';
    // Changing the DOM synchronously inside dragstart makes Chromium cancel the drag.
    setTimeout(() => setIsDragging(true), 0);
  }, []);

  const onDragEnd = useCallback(() => {
    activeDrag = null;
    setIsDragging(false);
  }, []);

  return {
    isDragging,
    dragSourceProps: { draggable: options.canDrag ?? true, onDragStart, onDragEnd },
  };
}

function findSubject(event: React.DragEvent, accept: string[]): DragSubject | null {
  if (accept.includes(DRAG_TYPE_FILES) && event.dataTransfer.types.includes('Files')) {
    return { type: DRAG_TYPE_FILES, item: null, files: Array.from(event.dataTransfer.files) };
  }
  if (activeDrag != null && accept.includes(activeDrag.type)) {
    return { type: activeDrag.type, item: activeDrag.item, files: [] };
  }
  return null;
}

/**
 * The innermost target that accepts a drag handles it: it stops the event from reaching outer targets and is the
 * only one reported as `isOver`.
 */
export function useDropTarget(options: DropTargetOptions): {
  isOver: boolean;
  dropTargetProps: Pick<React.HTMLAttributes<HTMLElement>, 'onDragOver' | 'onDragLeave' | 'onDrop'>;
} {
  const optionsRef = useRef(options);
  useLayoutEffect(() => {
    optionsRef.current = options;
  });
  const targetId = useMemo(() => Symbol('drop-target'), []);

  const isOver = useSyncExternalStore(subscribeToClaims, () => claimedTargetId === targetId);

  useEffect(() => () => releaseTarget(targetId), [targetId]);

  const onDragOver = useCallback(
    (event: React.DragEvent) => {
      const { accept, canDrop, onHover } = optionsRef.current;
      const subject = findSubject(event, accept);
      if (subject == null) {
        return;
      }
      event.stopPropagation();
      if (canDrop != null && !canDrop(subject)) {
        event.dataTransfer.dropEffect = 'none';
        releaseTarget(targetId);
        return;
      }
      // Without preventDefault on dragover the browser refuses the drop.
      event.preventDefault();
      const copies = subject.type === DRAG_TYPE_FILES || event.ctrlKey || event.metaKey;
      event.dataTransfer.dropEffect = copies ? 'copy' : 'move';
      claimTarget(targetId);
      onHover?.(subject, event);
    },
    [targetId],
  );

  const onDragLeave = useCallback(
    (event: React.DragEvent) => {
      const enteredElement = event.relatedTarget;
      if (enteredElement instanceof Node && event.currentTarget.contains(enteredElement)) {
        return;
      }
      releaseTarget(targetId);
    },
    [targetId],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      const { accept, canDrop, onDrop: handleDrop } = optionsRef.current;
      const subject = findSubject(event, accept);
      if (subject == null) {
        return;
      }
      event.stopPropagation();
      event.preventDefault();
      releaseTarget(targetId);
      if (canDrop != null && !canDrop(subject)) {
        return;
      }
      handleDrop(subject, event);
    },
    [targetId],
  );

  return { isOver, dropTargetProps: { onDragOver, onDragLeave, onDrop } };
}
