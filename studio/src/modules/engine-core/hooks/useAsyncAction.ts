import { useCallback, useEffect, useRef, useState } from 'react';

interface AsyncActionState {
  isLoading: boolean;
  error: Error | null;
}

interface AsyncActionResult<TArgs extends unknown[] = unknown[]> extends AsyncActionState {
  execute: (...args: TArgs) => Promise<void>;
  reset: () => void;
}

/**
 * Wraps an async operation with loading state tracking. Designed for toolbar
 * buttons that must be disabled while their operation is in flight (§3.5.2).
 *
 * Usage:
 *   const deploy = useAsyncAction(async (file: string) => {
 *     await client.processes.deploy(file);
 *   });
 *   <button disabled={deploy.isLoading} onClick={() => deploy.execute(xmlContent)}>Deploy</button>
 */
export function useAsyncAction<TArgs extends unknown[]>(
  action: (...args: TArgs) => Promise<void>,
): AsyncActionResult<TArgs> {
  const [state, setState] = useState<AsyncActionState>({ isLoading: false, error: null });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const execute = useCallback(
    async (...args: TArgs) => {
      if (state.isLoading) {
        return;
      }

      setState({ isLoading: true, error: null });
      try {
        await action(...args);
        if (mountedRef.current) {
          setState({ isLoading: false, error: null });
        }
      } catch (error) {
        if (mountedRef.current) {
          setState({ isLoading: false, error: error instanceof Error ? error : new Error(String(error)) });
        }
      }
    },
    [action, state.isLoading],
  );

  const reset = useCallback(() => {
    setState({ isLoading: false, error: null });
  }, []);

  return { ...state, execute, reset };
}
