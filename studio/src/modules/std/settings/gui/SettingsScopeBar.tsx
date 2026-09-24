import type { Bifrost } from '#bifrost/Bifrost';
import { EVENT_SOLUTION_CHANGED } from '#bifrost/common/SolutionManager';
import type { SettingsScopeTarget } from '#bifrost/contracts/SettingsScopeTypes';

import React, { useEffect, useState } from 'react';

type SettingsScopeBarProps = {
  studio: Bifrost;
  target: SettingsScopeTarget;
  onTargetChange: (target: SettingsScopeTarget) => void;
};

type ScopeSnapshot = {
  availableTargets: SettingsScopeTarget[];
  projects: { baseUri: string; name: string }[];
};

function readScopeSnapshot(studio: Bifrost): ScopeSnapshot {
  return {
    availableTargets: studio.settings.getAvailableScopeTargets(),
    projects: studio.solution.getSolution()?.projects ?? [],
  };
}

export function SettingsScopeBar(props: SettingsScopeBarProps): React.JSX.Element {
  const { studio, target, onTargetChange } = props;
  const [snapshot, setSnapshot] = useState(() => readScopeSnapshot(studio));
  const { availableTargets, projects } = snapshot;

  useEffect(() => {
    const subscription = studio.solution.on(EVENT_SOLUTION_CHANGED, () => {
      setSnapshot(readScopeSnapshot(studio));
    });
    return () => subscription.dispose();
  }, [studio]);

  const projectTargets = availableTargets.filter((candidate) => candidate.scope === 'project');
  const hasSolution = availableTargets.some((candidate) => candidate.scope === 'solution');

  return (
    <div className="settings-gui__scope-bar" data-test-settings-scope-bar>
      <button
        type="button"
        className={target.scope === 'user' ? 'settings-gui__scope-button is-active' : 'settings-gui__scope-button'}
        data-test-settings-scope="user"
        onClick={() => onTargetChange({ scope: 'user' })}
      >
        User
      </button>
      {hasSolution && (
        <button
          type="button"
          className={
            target.scope === 'solution' ? 'settings-gui__scope-button is-active' : 'settings-gui__scope-button'
          }
          data-test-settings-scope="solution"
          onClick={() => onTargetChange({ scope: 'solution' })}
        >
          Solution
        </button>
      )}
      {projectTargets.length === 1 && projectTargets[0].scope === 'project' && (
        <button
          type="button"
          className={target.scope === 'project' ? 'settings-gui__scope-button is-active' : 'settings-gui__scope-button'}
          data-test-settings-scope="project"
          onClick={() => onTargetChange(projectTargets[0])}
        >
          {projectLabel(projects, projectTargets[0].projectBaseUri)}
        </button>
      )}
      {projectTargets.length > 1 && (
        <select
          className="settings-gui__scope-select"
          data-test-settings-scope="project"
          value={target.scope === 'project' ? target.projectBaseUri : ''}
          onChange={(event) => {
            const projectBaseUri = event.target.value;
            if (projectBaseUri !== '') {
              onTargetChange({ scope: 'project', projectBaseUri });
            }
          }}
        >
          <option value="">Project</option>
          {projectTargets.map((candidate) =>
            candidate.scope === 'project' ? (
              <option key={candidate.projectBaseUri} value={candidate.projectBaseUri}>
                {projectLabel(projects, candidate.projectBaseUri)}
              </option>
            ) : null,
          )}
        </select>
      )}
    </div>
  );
}

function projectLabel(projects: { baseUri: string; name: string }[], projectBaseUri: string): string {
  return projects.find((project) => project.baseUri === projectBaseUri)?.name ?? 'Project';
}
