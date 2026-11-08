import type { ELK, ElkNode } from 'elkjs/lib/elk-api';
import ElkEngine from 'elkjs/lib/elk-api';

const LAYOUT_TIMEOUT_MILLISECONDS = 30_000;

type Engine = { elk: ELK; failure: Promise<never> };

let engine: Engine | null = null;

/** Started on first use: the algorithm lives in a 1.6 MB worker script that is copied to `out/` unchanged. */
function getEngine(): Engine {
  if (engine != null) {
    return engine;
  }
  let reportFailure: (error: Error) => void = () => undefined;
  const failure = new Promise<never>((_resolve, reject) => (reportFailure = reject));
  failure.catch(() => undefined);
  const elk = new ElkEngine({
    workerUrl: new URL('out/elk-worker.min.js', document.baseURI).href,
    // The worker script exports itself when it finds a `module`. With `nodeIntegrationInWorker` there is a `module`
    // but no `exports`, so it would throw before it listens for messages.
    workerFactory: (url) => {
      const bootstrap = `var exports = {}; importScripts(${JSON.stringify(url)});`;
      const worker = new Worker(URL.createObjectURL(new Blob([bootstrap], { type: 'text/javascript' })));
      worker.addEventListener('error', (event) => {
        worker.terminate();
        engine = null;
        reportFailure(new Error(`The layout engine failed to start: ${event.message}`));
      });
      return worker;
    },
  });
  engine = { elk, failure };
  return engine;
}

/**
 * Runs the Eclipse Layout Kernel on `graph` in the bundled worker (or the in-process fallback under test).
 * Rejects on worker startup failure or when layout exceeds 30 seconds.
 */
export async function layoutElkNode(graph: ElkNode): Promise<ElkNode> {
  const { elk, failure } = getEngine();
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      // The worker may still be computing; the next layout starts a fresh one.
      elk.terminateWorker();
      engine = null;
      reject(new Error(`The layout did not finish within ${LAYOUT_TIMEOUT_MILLISECONDS / 1000} seconds.`));
    }, LAYOUT_TIMEOUT_MILLISECONDS);
  });
  try {
    return await Promise.race([elk.layout(graph), timeout, failure]);
  } finally {
    clearTimeout(timeoutHandle);
  }
}
