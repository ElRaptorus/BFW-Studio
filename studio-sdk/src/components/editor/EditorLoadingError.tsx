import React from 'react';

type EditorLoadingErrorProps = {
  title?: string | React.JSX.Element;
  subtitle?: string | React.JSX.Element;
  errorMessage?: any;
};

const DEFAULT_TITLE = 'Unable to load document';
const DEFAULT_SUBTITLE = 'The following error was raised while loading the requested document:';

export function EditorLoadingError(props: EditorLoadingErrorProps): React.JSX.Element {
  const title = props.title ?? DEFAULT_TITLE;
  const subtitle = props.subtitle ?? DEFAULT_SUBTITLE;

  return (
    <div className="editor__content editor__content--loading-error">
      <div className="loading-error">
        <div className="loading-error__title">
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {props.errorMessage && (
          <div className="loading-error__error-message">
            <pre>{props.errorMessage.toString()}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
