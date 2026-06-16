import { useCallback, useEffect, useRef } from 'react';

export type Position = { x: number; y: number; width?: number; height?: number };
const lastScrollPositions: { [key: string]: Position } = {};

type ScrollPositionOptions = {
  precise?: boolean;
  saveCallback?: (position: Position) => any;
  customRestore?: () => Promise<Position> | Position | null;
  restoreOnUpdate?: boolean;
};

export function useScrollPositionManager(
  scrollKey: string,
  options?: ScrollPositionOptions,
): (target: HTMLDivElement) => void {
  const targetRef = useRef<HTMLDivElement | undefined>(undefined);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const scrollPositionRef = useRef<Position | undefined>(undefined);

  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const saveScrollPosition = useCallback(
    (position: Position) => {
      lastScrollPositions[scrollKey] = position;
      optionsRef.current?.saveCallback?.(position);
    },
    [scrollKey],
  );

  const getCurrentPosition = useCallback((): Position | undefined => {
    if (!targetRef.current) {
      return undefined;
    }
    const x = targetRef.current.scrollLeft;
    const y = targetRef.current.scrollTop;
    const width = targetRef.current.getBoundingClientRect().width;
    const height = targetRef.current.getBoundingClientRect().height;
    return { x, y, width, height };
  }, []);

  const restoreScrollPosition = useCallback(() => {
    requestAnimationFrame(async () => {
      const lastScrollPosition = optionsRef.current?.customRestore
        ? await optionsRef.current.customRestore()
        : lastScrollPositions[scrollKey];
      if (!lastScrollPosition || !targetRef.current) {
        return;
      }

      const boundingClientRect = targetRef.current.getBoundingClientRect();
      const xOffset = lastScrollPosition.width ? lastScrollPosition.width - boundingClientRect.width : 0;
      const yOffset = lastScrollPosition.height ? lastScrollPosition.height - boundingClientRect.height : 0;

      targetRef.current.scrollLeft = lastScrollPosition.x + xOffset;
      targetRef.current.scrollTop = lastScrollPosition.y + yOffset;
    });
  }, [scrollKey]);

  const handleScroll = useCallback(() => {
    if (!targetRef.current) {
      return;
    }

    scrollPositionRef.current = getCurrentPosition();
    clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      requestAnimationFrame(() => {
        saveScrollPosition(scrollPositionRef.current!);
        scrollTimeoutRef.current = undefined;
      });
    }, 200);
  }, [getCurrentPosition, saveScrollPosition]);

  useEffect(() => {
    restoreScrollPosition();

    return () => {
      if (scrollTimeoutRef.current && scrollPositionRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = undefined;
        saveScrollPosition(scrollPositionRef.current);
      }

      if (!targetRef.current) {
        return;
      }

      if (!optionsRef.current?.precise) {
        const pos = getCurrentPosition();
        if (pos) {
          saveScrollPosition(pos);
        }
      }

      targetRef.current.onscroll = null;
    };
  }, [restoreScrollPosition, saveScrollPosition, getCurrentPosition]);

  useEffect(() => {
    if (!targetRef.current) {
      return;
    }
    targetRef.current.onscroll = options?.precise ? handleScroll : null;
  }, [options?.precise, handleScroll]);

  useEffect(() => {
    if (options?.restoreOnUpdate) {
      restoreScrollPosition();
    }
  });

  const connectScrollTarget = useCallback(
    (target: HTMLDivElement) => {
      targetRef.current = target;
      if (!target || !optionsRef.current?.precise) {
        return;
      }
      target.onscroll = handleScroll;
    },
    [handleScroll],
  );

  return connectScrollTarget;
}
