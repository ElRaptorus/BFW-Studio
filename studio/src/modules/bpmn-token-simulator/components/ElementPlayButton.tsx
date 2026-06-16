import React from 'react';

export interface ElementPlayButtonProps {
  onContinue: () => void;
}

export function ElementPlayButton(props: ElementPlayButtonProps): React.ReactElement {
  return (
    <button className="token-sim-play-btn" onClick={props.onContinue} title="Continue" aria-label="Continue">
      <i className="ph-fill ph-play-circle" />
    </button>
  );
}
