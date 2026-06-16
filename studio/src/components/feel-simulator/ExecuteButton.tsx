import React from 'react';

type ExecuteButtonProps = {
  onClick: () => void;
  disabled: boolean;
  testId: string;
};

export function ExecuteButton(props: ExecuteButtonProps): React.JSX.Element {
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      title="Execute expression (Ctrl+Enter)"
      data-test--feel-execute={props.testId}
      className="feel-simulator__execute-button"
    >
      ▶
    </button>
  );
}
