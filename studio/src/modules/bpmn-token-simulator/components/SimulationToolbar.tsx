import React, { useCallback, useMemo } from 'react';

import type { SimulationMode } from '../core/SimulationEngine';
import { SimulationLogPanel } from './SimulationLogPanel';

const SPEED_STEPS: number[] = [
  0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0,
];
const DEFAULT_POSITION = 9;

export interface SimulationLogEntry {
  time: number;
  event: string;
  elementId: string;
  elementName: string;
}

export interface SimulationToolbarProps {
  isRunning: boolean;
  isPaused: boolean;
  mode: SimulationMode;
  speed: number;
  showCounters: boolean;
  showLog: boolean;
  hasTraceData: boolean;
  logEntries: SimulationLogEntry[];
  onStart: () => void;
  onReplay: () => void;
  onReset: () => void;
  onPauseResume: () => void;
  onSpeedChange: (speed: number) => void;
  onModeChange: (mode: SimulationMode) => void;
  onToggleCounters: () => void;
  onToggleLog: () => void;
  onExportTrace: () => void;
  onClose: () => void;
}

export function SimulationToolbar(props: SimulationToolbarProps): React.ReactElement {
  const {
    isRunning,
    isPaused,
    mode,
    speed,
    showCounters,
    showLog,
    hasTraceData,
    logEntries,
    onStart,
    onReplay,
    onReset,
    onPauseResume,
    onSpeedChange,
    onModeChange,
    onToggleCounters,
    onToggleLog,
    onExportTrace,
    onClose,
  } = props;

  const toggleMode = useCallback(() => {
    onModeChange(mode === 'auto' ? 'step' : 'auto');
  }, [mode, onModeChange]);

  const sliderPosition = useMemo(() => {
    let closest = DEFAULT_POSITION;
    let minDist = Infinity;
    for (let i = 0; i < SPEED_STEPS.length; i++) {
      const dist = Math.abs(SPEED_STEPS[i] - speed);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    }
    return closest;
  }, [speed]);

  const handleSpeedSlider = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const pos = parseInt(e.target.value, 10);
      onSpeedChange(SPEED_STEPS[pos]);
    },
    [onSpeedChange],
  );

  const resetSpeed = useCallback(() => {
    onSpeedChange(1.0);
  }, [onSpeedChange]);

  const startBtnClass = `token-sim-toolbar__btn ${isRunning ? 'token-sim-toolbar__btn--running' : ''}`;

  const pauseLabel = isPaused ? 'Resume' : 'Pause';
  const modeLabel = mode === 'auto' ? 'Switch to step mode' : 'Switch to auto mode';
  const hasLog = showLog;

  return (
    <div className="token-sim-toolbar-wrapper">
      <div className={`token-sim-toolbar ${hasLog ? 'token-sim-toolbar--log-open' : ''}`}>
        <button
          className={startBtnClass}
          onClick={onStart}
          disabled={isRunning}
          title="Start simulation"
          aria-label="Start simulation"
        >
          <i className="ph ph-play" />
        </button>

        {isRunning && (
          <button
            className="token-sim-toolbar__btn"
            onClick={onReplay}
            title="Replay simulation"
            aria-label="Replay simulation"
          >
            <i className="ph ph-arrow-counter-clockwise" />
          </button>
        )}

        {isRunning && (
          <button className="token-sim-toolbar__btn" onClick={onPauseResume} title={pauseLabel} aria-label={pauseLabel}>
            <i className={isPaused ? 'ph ph-play' : 'ph ph-pause'} />
          </button>
        )}

        <button
          className="token-sim-toolbar__btn"
          onClick={onReset}
          disabled={!isRunning}
          title="Reset simulation"
          aria-label="Reset simulation"
        >
          <i className="ph ph-stop" />
        </button>

        <span className="token-sim-toolbar__separator" />

        <button
          className={`token-sim-toolbar__btn ${mode === 'step' ? 'token-sim-toolbar__btn--active' : ''}`}
          onClick={toggleMode}
          title={modeLabel}
          aria-label={modeLabel}
          aria-pressed={mode === 'step'}
        >
          <i className="ph ph-sneaker-move" />
        </button>

        <span className="token-sim-toolbar__separator" />

        <button
          className={`token-sim-toolbar__btn ${showCounters ? 'token-sim-toolbar__btn--active' : ''}`}
          onClick={onToggleCounters}
          title={showCounters ? 'Hide token counters' : 'Show token counters'}
          aria-label={showCounters ? 'Hide token counters' : 'Show token counters'}
          aria-pressed={showCounters}
        >
          <i className="ph ph-hash" />
        </button>

        <button
          className={`token-sim-toolbar__btn ${showLog ? 'token-sim-toolbar__btn--active' : ''}`}
          onClick={onToggleLog}
          title={showLog ? 'Hide simulation log' : 'Show simulation log'}
          aria-label={showLog ? 'Hide simulation log' : 'Show simulation log'}
          aria-pressed={showLog}
        >
          <i className="ph ph-list-bullets" />
        </button>

        <button
          className="token-sim-toolbar__btn"
          onClick={onExportTrace}
          title="Export simulation trace"
          aria-label="Export simulation trace"
          disabled={!hasTraceData}
        >
          <i className="ph ph-download-simple" />
        </button>

        <span className="token-sim-toolbar__separator" />

        <button
          className="token-sim-toolbar__btn"
          onClick={onClose}
          title="Close token simulation"
          aria-label="Close token simulation"
        >
          <i className="ph ph-x" />
        </button>
      </div>

      <div className="token-sim-toolbar__speed-row">
        <i className="ph ph-gauge" />
        <input
          className="token-sim-speed-slider"
          type="range"
          min={0}
          max={SPEED_STEPS.length - 1}
          step={1}
          value={sliderPosition}
          onChange={handleSpeedSlider}
          title={`Speed: ${speed}x`}
          aria-label={`Simulation speed: ${speed}x`}
        />
        <button
          className="token-sim-speed-label"
          onClick={resetSpeed}
          title="Click to reset speed to 1x"
          aria-label={`Speed: ${speed}x — click to reset to 1x`}
        >
          {speed}x
        </button>
      </div>

      <SimulationLogPanel entries={logEntries} visible={showLog} />
    </div>
  );
}
