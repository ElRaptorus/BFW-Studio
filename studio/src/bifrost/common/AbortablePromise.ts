/**
 * Loosely based on https://gist.github.com/andrewcourtice/ef1b8f14935b409cfe94901558ba5594
 */
export class AbortablePromise<T> extends Promise<T> {
  private pending: boolean = true;
  private abortController: AbortController;

  constructor(
    executor: (
      resolve: (value: T) => void,
      reject: (reason?: any) => void,
      onAbort: (abortCallback: (reason?: any) => void) => void,
    ) => void,
  ) {
    const abortController = new AbortController();
    const setPending = (pending: boolean) => (this.pending = pending);
    super((_resolve, _reject) => {
      const { pendingResolve, pendingReject } = AbortablePromise.registerPendingHandler(_resolve, _reject, setPending);
      const { saveResolve, saveReject, onAbort } = AbortablePromise.registerAbortHandler(
        pendingResolve,
        pendingReject,
        abortController.signal,
      );

      executor(saveResolve, saveReject, onAbort);
    });
    this.abortController = abortController;
  }

  public abort() {
    this.abortController.abort();
  }

  get isPending(): boolean {
    return this.pending;
  }

  private static registerPendingHandler(
    resolve: (value: any) => void,
    reject: (reason?: any) => void,
    setPending: (pending: boolean) => void,
  ): { pendingResolve: (value: any) => void; pendingReject: (reason?: any) => void } {
    return {
      pendingResolve: (value) => {
        setPending(false);
        resolve(value);
      },
      pendingReject: (reason) => {
        setPending(false);
        reject(reason);
      },
    };
  }

  private static registerAbortHandler(
    resolve: (value: any) => void,
    reject: (reason?: any) => void,
    abortSignal: AbortSignal,
  ): { saveResolve: (value: any) => void; saveReject: (reason?: any) => void; onAbort: (reason?: any) => void } {
    let abortCallback = (_reason?: any) => {};
    let abortHandler = (_reason?: any) => {};
    const onAbort = (_abortCallback: (reason?: any) => void) => {
      abortCallback = _abortCallback;
    };

    const cleanup = () => {
      abortSignal.removeEventListener('abort', abortHandler);
    };

    const saveResolve = AbortablePromise.wrapWithFinal(resolve, cleanup);
    const saveReject = AbortablePromise.wrapWithFinal(reject, cleanup);

    abortHandler = (reason?: any) => {
      abortCallback(reason);
      saveReject(reason);
    };

    abortSignal.addEventListener('abort', abortHandler, { once: true });

    return { saveResolve: saveResolve, saveReject: saveReject, onAbort: onAbort };
  }

  private static wrapWithFinal(callee: (...args: any[]) => void, final: () => void): (...args: any[]) => void {
    return (...args: any[]) => {
      try {
        return callee(...args);
      } finally {
        final();
      }
    };
  }
}
