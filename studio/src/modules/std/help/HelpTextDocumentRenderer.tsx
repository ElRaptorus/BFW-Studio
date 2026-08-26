import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocumentRendererProps } from '#bifrost/contracts/EditorTypes';
import { Editor } from '#components/editor/Editor';
import { EditorContent } from '#components/editor/EditorContent';
import { marked } from 'marked';

import React, { useEffect, useState } from 'react';

import type { HelpTextDocumentModel } from './HelpTextDocumentModel';

type MarkdownRendererProps = {
  readonly bifrost: Bifrost;
  readonly className?: string;
  readonly markdown: string;
};

export function HelpTextDocumentRenderer(props: EditorDocumentRendererProps): React.JSX.Element {
  const editorDocumentModelPromise = props.studio.editors.getEditorDocumentModel<HelpTextDocumentModel>(
    props.editorDocument,
  );

  return (
    <Editor>
      <EditorContent>
        <PromiseRenderer
          promise={editorDocumentModelPromise}
          resolve={(editorDocumentModel) => (
            <MarkdownRenderer
              bifrost={props.studio}
              className="help-page"
              markdown={editorDocumentModel.getMarkdown()}
            />
          )}
        />
      </EditorContent>
    </Editor>
  );
}

type PromiseResolveRendererProps<T = any> = {
  promise: Promise<T>;
  resolve: (promiseResult: T) => React.JSX.Element | null;
  placeholder?: React.JSX.Element | string | null;
};

function PromiseRenderer<T = any>(props: PromiseResolveRendererProps<T>): React.JSX.Element | string | null {
  const [resolved, setResolved] = useState(false);
  const [promiseResult, setPromiseResult] = useState<T | undefined>(undefined);

  useEffect(() => {
    props.promise.then((result: T) => {
      setResolved(true);
      setPromiseResult(result);
    });
  }, [props.promise]);

  if (resolved) {
    return props.resolve(promiseResult as T);
  } else {
    return props.placeholder || null;
  }
}

function MarkdownRenderer(props: MarkdownRendererProps): React.JSX.Element {
  const html = marked(props.markdown, { async: false }) as string;

  return (
    // eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml -- marked() renders help markdown to HTML
    <div className={props.className} dangerouslySetInnerHTML={{ __html: html }}></div>
  );
}
