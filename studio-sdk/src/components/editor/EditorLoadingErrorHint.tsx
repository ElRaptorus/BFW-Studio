import React from 'react';

type EditorLoadingErrorHintProps = {
  errorMessage: any;
  retryNowHandler?: () => void;
};

export function EditorLoadingErrorHint(props: EditorLoadingErrorHintProps): React.JSX.Element {
  return (
    <div className="editor__hint editor__hint--loading-error">
      <span>{props.errorMessage.toString()}</span>
      {props.retryNowHandler && (
        <button className="btn btn-sm btn-danger editor__hint-button" onClick={() => props.retryNowHandler?.()}>
          Retry now
        </button>
      )}
    </div>
  );
}
