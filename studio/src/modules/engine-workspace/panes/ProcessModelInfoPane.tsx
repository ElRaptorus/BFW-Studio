import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneHeader } from '#components/panes/PaneHeader';
import type { EngineConnectionManager } from '#modules/engine-core';
import { getHumanizedDateTime } from '#modules/engine-core';
import type { ProcessModel } from '@elraptorus/daemonengine_sdk';

import React, { useEffect, useState } from 'react';

import { PaneProperty } from '@evil/bifrost_fw_sdk';

import type { ProcessExplorerDocumentModel } from '../models/ProcessExplorerDocumentModel';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Process Model Info';
}

function shouldBeDisplayed(editorDocument: EditorDocument | null | undefined): boolean {
  return editorDocument?.uri.startsWith('engine://processes/') === true;
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as ProcessExplorerDocumentModel | null;
  const processModel = model?.getSelectedModel() ?? null;

  if (!processModel) {
    return null;
  }

  const bpmnId = processModel.processModelId ?? processModel.id;

  return (
    <div className="engine-pane-process-info">
      <PaneProperty type="text" label="Name" value={processModel.name ?? '(unnamed)'} disabled />
      <PaneProperty type="text" label="Process ID" value={bpmnId} disabled />
      <PaneProperty type="text" label="Version" value={processModel.version ?? '—'} disabled />
      <PaneProperty type="text" label="Status" value={processModel.enabled ? 'Enabled' : 'Disabled'} disabled />
      <PaneProperty
        type="text"
        label="Deployed"
        value={processModel.deployedAt ? getHumanizedDateTime(processModel.deployedAt) : '—'}
        disabled
      />
      {processModel.definitionsId && (
        <PaneProperty type="text" label="Definitions ID" value={processModel.definitionsId} disabled />
      )}
      <VersionBrowser studio={props.studio} processId={bpmnId} engineId={extractEngineId(props.editorDocument.uri)} />
    </div>
  );
}

function VersionBrowser(props: {
  studio: PaneComponentProps['studio'];
  processId: string;
  engineId: string;
}): React.JSX.Element | null {
  const [versions, setVersions] = useState<ProcessModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const connectionManager = props.studio.getSharedRessource<EngineConnectionManager>('engineConnectionManager');
    const client = props.engineId ? connectionManager.getClient(props.engineId) : null;

    const fetchVersions = async (): Promise<void> => {
      if (!client) {
        if (!cancelled) {
          setVersions([]);
          setLoading(false);
        }
        return;
      }

      try {
        const result = await client.processes.getVersions(props.processId);
        if (!cancelled) {
          setVersions(result);
        }
      } catch (versionFetchError) {
        console.warn('[ProcessModelInfo] Failed to fetch versions for', props.processId, versionFetchError);
        if (!cancelled) {
          setVersions([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchVersions();

    return () => {
      cancelled = true;
    };
  }, [props.studio, props.processId, props.engineId]);

  if (loading) {
    return (
      <div className="engine-pane-version-browser">
        <div className="engine-pane-version-browser__header">Versions</div>
        <div className="engine-pane-version-browser__loading">Loading...</div>
      </div>
    );
  }

  if (versions.length === 0) {
    return null;
  }

  return (
    <div className="engine-pane-version-browser">
      <div className="engine-pane-version-browser__header">Versions ({versions.length})</div>
      {versions.map((version) => (
        <div key={String(version.version)} className="engine-pane-version-browser__item">
          <span className="engine-pane-version-browser__version">{version.version ?? '(no version)'}</span>
          <span className="engine-pane-version-browser__date">
            {version.deployedAt ? getHumanizedDateTime(version.deployedAt) : '—'}
          </span>
          <span
            className={`engine-pane-version-browser__status ${version.enabled ? 'engine-pane-version-browser__status--enabled' : 'engine-pane-version-browser__status--disabled'}`}
          >
            {version.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      ))}
    </div>
  );
}

function extractEngineId(uri: string): string {
  const match = uri.match(/engine:\/\/processes\/([^?]+)/);
  return match?.[1] ?? '';
}
