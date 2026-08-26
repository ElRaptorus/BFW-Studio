import type { Bifrost } from '#bifrost/Bifrost';
import { showContextMenu } from '#components/ContextMenuFunctions';
import { EditorContent } from '#components/editor/EditorContent';

import React from 'react';

export default function ErrorHandlingExamples(props: any): React.JSX.Element {
  const bifrost: Bifrost = props.bifrost;
  const cmd = bifrost.commands.getClickHandler();

  return (
    <EditorContent>
      <div className="machine-sanctum-subpage">
        <h2>Error examples</h2>
        <p>Whenever an error happens, the user should be able to tell that something went wrong.</p>
        <p>
          The buttons below can help Bifrost devs test this behaviour by provoking all kinds of technically different
          errors.
        </p>

        <div className="row my-1">
          <div className="machine-sanctum-example col-6">
            <div className="machine-sanctum-example__interaction-options">
              <button
                onClick={() => {
                  throw new Error('error in vanilla clickHandler');
                }}
                className="btn btn-danger"
              >
                Throw error in vanilla clickHandler
              </button>
            </div>
          </div>
          <div className="col-6">
            <pre className="machine-sanctum-example__code">
              throw new Error(&apos;error in vanilla clickHandler&apos;);
            </pre>
          </div>
        </div>

        <div className="row my-1">
          <div className="machine-sanctum-example col-6">
            <div className="machine-sanctum-example__interaction-options">
              <button
                onClick={() =>
                  setTimeout(() => {
                    throw new Error('error in setTimeout() in a vanilla clickHandler');
                  }, 500)
                }
                className="btn btn-danger"
              >
                Throw error in setTimeout() in a vanilla clickHandler
              </button>
            </div>
          </div>
          <div className="col-6">
            <pre className="machine-sanctum-example__code">
              {`setTimeout(() => throw new Error('error in setTimeout() in a vanilla clickHandler'), 500)`}
            </pre>
          </div>
        </div>

        <div className="row my-1">
          <div className="machine-sanctum-example col-6">
            <div className="machine-sanctum-example__interaction-options">
              <button onClick={cmd('dev.machineSanctum.test.throwError')} className="btn btn-danger">
                Throw error in Bifrost command
              </button>
            </div>
          </div>
          <div className="col-6">
            <pre className="machine-sanctum-example__code">cmd(&apos;dev.machineSanctum.test.throwError&apos;)</pre>
          </div>
        </div>

        <div className="row my-1">
          <div className="machine-sanctum-example col-6">
            <div className="machine-sanctum-example__interaction-options">
              <button onClick={cmd('dev.machineSanctum.test.throwErrorInSettimeout')} className="btn btn-danger">
                Throw error in a setTimeout() in a Bifrost command
              </button>
            </div>
          </div>
          <div className="col-6">
            <pre className="machine-sanctum-example__code">
              cmd(&apos;dev.machineSanctum.test.throwErrorInSettimeout&apos;)
            </pre>
          </div>
        </div>

        <div className="row my-1">
          <div className="machine-sanctum-example col-6">
            <div className="machine-sanctum-example__interaction-options">
              <button
                onClick={async () => {
                  throw new Error('error in vanilla clickHandler');
                }}
                className="btn btn-danger"
              >
                Throw error in async clickHandler
              </button>
            </div>
          </div>
          <div className="col-6">
            <pre className="machine-sanctum-example__code">
              {`async () => throw new Error('error in vanilla clickHandler');`}
            </pre>
          </div>
        </div>

        <div className="row my-1">
          <div className="machine-sanctum-example col-6">
            <div className="machine-sanctum-example__interaction-options">
              <button
                onClick={async () => {
                  await bifrost.http.postJson('asdf', {});
                }}
                className="btn btn-danger"
              >
                Throw error by posting to none existing URI
              </button>
            </div>
          </div>
          <div className="col-6">
            <pre className="machine-sanctum-example__code">
              await bifrost.http.postJson(&apos;asdf&apos;, &#123;&quot;foo&quot;: &quot;bar&quot;&#125;)
            </pre>
          </div>
        </div>

        <div className="row my-1">
          <div className="machine-sanctum-example col-6">
            <div className="machine-sanctum-example__interaction-options">
              <button
                onClick={(event) => showContextMenu(event, 'machine-sanctum/error_example')}
                onContextMenu={(event) => showContextMenu(event, 'machine-sanctum/error_example')}
                className="btn btn-danger"
              >
                Throw error while building context menu
              </button>
            </div>
          </div>
          <div className="col-6">
            <pre className="machine-sanctum-example__code">Throws an error in its menu factory function.</pre>
          </div>
        </div>
      </div>
    </EditorContent>
  );
}
