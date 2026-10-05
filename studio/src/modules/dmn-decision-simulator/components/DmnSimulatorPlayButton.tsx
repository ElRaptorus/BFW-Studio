import React from 'react';

export type DmnSimulatorPlayButtonProps = {
  title: string;
  onPlay: () => void;
};

export function DmnSimulatorPlayButton(props: DmnSimulatorPlayButtonProps): React.ReactElement {
  return (
    <button
      className="dmn-sim-play"
      title={props.title}
      aria-label={props.title}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        props.onPlay();
      }}
    >
      <i className="ph-fill ph-play-circle" />
    </button>
  );
}
