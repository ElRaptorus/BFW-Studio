import type { ManifestPaneContribution } from '#bifrost/common/plugin-host/manifest/ManifestTypes';
import type { PaneComponentProps, PaneProvider, PaneProviderModule } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneHeader } from '#components/panes/PaneHeader';

import React from 'react';

interface PlaceholderPaneProviderContext {
  pluginName: string;
  pane: ManifestPaneContribution;
}

export function createPlaceholderPaneProvider(context: PlaceholderPaneProviderContext): PaneProviderModule {
  function PlaceholderPaneContent(_props: PaneComponentProps): React.JSX.Element {
    return (
      <div className="placeholder-pane-content">
        <span className="ph ph-clock placeholder-pane-content__icon" />
        <span className="placeholder-pane-content__text">Activating plugin…</span>
      </div>
    );
  }

  function PlaceholderPane(props: PaneComponentProps): React.JSX.Element {
    return (
      <Pane>
        <PaneHeader
          studio={props.studio}
          title={context.pane.title}
          paneId={props.paneId}
          collapsed={props.collapsed}
        />
        {props.collapsed !== true && <PlaceholderPaneContent {...props} />}
      </Pane>
    );
  }

  const paneProvider: PaneProvider = {
    getPaneTitle: () => context.pane.title,
    shouldBeDisplayed: (editorDocument, _editorDocumentModel, studio) => {
      if (context.pane.visibleWhen?.setting != null) {
        try {
          if (!studio.settings.get(context.pane.visibleWhen.setting)) {
            return false;
          }
        } catch {
          return false;
        }
      }
      if (
        context.pane.visibleWhen?.documentType != null &&
        editorDocument?.documentType !== context.pane.visibleWhen.documentType
      ) {
        return false;
      }
      return true;
    },
    Pane: PlaceholderPane,
    PaneContent: PlaceholderPaneContent,
  };

  return { paneProvider };
}
