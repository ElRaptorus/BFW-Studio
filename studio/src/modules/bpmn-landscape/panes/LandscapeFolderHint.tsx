import type { Bifrost } from '#bifrost/Bifrost';
import { EVENT_EXPLORER_VIEW_UPDATED } from '#bifrost/common/ExplorerMediator';

import React, { useEffect, useState } from 'react';

import { describeLandscapeFolder, getLandscapeGate } from '../landscapeFolder';

type HintAction = { label: string; command: string };

/** Explains what landscape maps still need (a saved solution, a landscape folder, a first map) and offers the step. */
export function LandscapeFolderHint(props: { studio: Bifrost }): React.JSX.Element {
  const bifrost = props.studio;
  const gate = getLandscapeGate(bifrost);
  const folderUri = gate.state === 'ready' ? gate.folderUri : null;
  const folderExists = useFolderExists(bifrost, folderUri);
  const clickHandler = bifrost.commands.getClickHandler();

  let text: string;
  let actions: HintAction[];
  switch (gate.state) {
    case 'no-solution':
      text = 'Landscape maps live in a solution.';
      actions = [{ label: 'Open Solution…', command: 'std.solution.openSolutionFile' }];
      break;
    case 'unsaved':
      text = 'Save it as a solution to use landscape maps.';
      actions = gate.isFolder
        ? [{ label: 'Convert to Solution…', command: 'std.solution.convertFolderToSolution' }]
        : [{ label: 'Save Solution As…', command: 'std.solution.saveSolutionAs' }];
      break;
    case 'no-folder':
      text = 'Landscape maps are kept in one landscape folder of the solution.';
      actions = [
        { label: 'Set Up Landscape Folder', command: 'bpmn.landscape.setUpLandscapeFolder' },
        { label: 'Choose Folder…', command: 'bpmn.landscape.chooseLandscapeFolder' },
      ];
      break;
    case 'ready':
      if (folderExists === false) {
        text = `The landscape folder ${describeLandscapeFolder(bifrost, gate.solutionFileUri, gate.folderUri)} does not exist.`;
        actions = [
          { label: 'Create Folder', command: 'bpmn.landscape.setUpLandscapeFolder' },
          { label: 'Choose Another Folder…', command: 'bpmn.landscape.chooseLandscapeFolder' },
        ];
      } else {
        text = 'No landscape maps yet.';
        actions = [{ label: 'New Landscape Map', command: 'bpmn.landscape.newMap' }];
      }
      break;
  }

  return (
    <div className="pane__content text-center py-4" data-test--landscape-folder-hint={gate.state}>
      <p>{text}</p>
      {actions.map((action) => (
        <p key={action.command}>
          <button onClick={clickHandler(action.command)} className="btn btn-secondary">
            {action.label}
          </button>
        </p>
      ))}
    </div>
  );
}

function useFolderExists(bifrost: Bifrost, folderUri: string | null): boolean | null {
  const [checked, setChecked] = useState<{ uri: string; exists: boolean } | null>(null);
  useEffect(() => {
    if (folderUri == null) {
      return;
    }
    let current = true;
    const check = (): void => {
      void bifrost.files.doesFileOrDirectoryExist(bifrost.files.getLocalFilenameForUri(folderUri)).then((exists) => {
        if (current) {
          setChecked({ uri: folderUri, exists });
        }
      });
    };
    check();
    const subscription = bifrost.explorers.on(EVENT_EXPLORER_VIEW_UPDATED, check);
    return () => {
      current = false;
      subscription.dispose();
    };
  }, [bifrost, folderUri]);
  return checked != null && checked.uri === folderUri ? checked.exists : null;
}
