import { ErrorBoundary } from '#components/ErrorBoundary';

import React, { useEffect } from 'react';

import type { EditorDocumentRendererProps, Studio } from '@evil/bifrost_fw_sdk';
import {
  Editor,
  EditorToolbar,
  EditorToolbarButton,
  EditorToolbarLeft,
  EditorToolbarMenu,
  EditorToolbarRight,
  Icon,
} from '@evil/bifrost_fw_sdk';

import ContextMenuExamples from './pages/ContextMenuExamples';
import DialogExamples from './pages/DialogExamples';
import MachineSanctumEditorResponsiveness from './pages/EditorResponsiveness';
import ErrorHandlingExamples from './pages/ErrorHandlingExamples';
import FeelEditorExamples from './pages/FeelEditorExamples';
import MachineSanctumHome from './pages/MachineSanctumHome';
import NotificationExamples from './pages/NotificationExamples';
import PropertyPanelExamples from './pages/PropertyPanelExamples';
import QuickJumpExamples from './pages/QuickJumpExamples';
import TreeviewExamples from './pages/TreeviewExamples';

function EmptyTab(): React.JSX.Element {
  return <div />;
}

const TAB_MAP: any = {
  home: MachineSanctumHome,
  notifications: NotificationExamples,
  dialogs: DialogExamples,
  treeview: TreeviewExamples,
  quickjump: QuickJumpExamples,
  contextmenu: ContextMenuExamples,
  errors: ErrorHandlingExamples,
  property_panel: PropertyPanelExamples,
  responsiveness: MachineSanctumEditorResponsiveness,
  responsiveness2: MachineSanctumEditorResponsiveness,
  feel_editor: FeelEditorExamples,
};
const TABS = ['home', 'notifications', 'dialogs', 'treeview', 'quickjump', 'feel_editor'];
const DEFAULT_TAB = 'home';

function capitalize(string: string): string {
  return string
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.substring(1))
    .join(' ');
}

export default function MachineSanctumRenderer(props: EditorDocumentRendererProps): React.JSX.Element {
  const path = props.uri.replace(/^about:machine-sanctum\/?/, '');
  const activeTab = path === '' ? DEFAULT_TAB : path;

  useEffect(() => {
    const label = path === '' ? 'Home' : capitalize(activeTab);
    props.studio.editors.updateEditorDocumentLabel(props.editorDocument, label);
  }, [props.studio, props.editorDocument, activeTab, path]);

  const bifrost = props.studio;
  const TabContent = TAB_MAP[activeTab] || EmptyTab;

  return (
    <Editor>
      <EditorToolbar>
        <EditorToolbarLeft>
          {TABS.map((tab: string) => (
            <TabLink key={tab} tab={tab} studio={bifrost} />
          ))}
        </EditorToolbarLeft>
        <EditorToolbarRight>
          <EditorToolbarMenu studio={bifrost} label="More" menuId="machine-sanctum/editor-toolbar/more-pages" />
        </EditorToolbarRight>
      </EditorToolbar>
      <ErrorBoundary key={activeTab}>
        <TabContent bifrost={props.studio} editorDocument={props.editorDocument} />
      </ErrorBoundary>
    </Editor>
  );
}

type TabLinkProps = {
  tab: string;
  studio: Studio;
};

function TabLink(props: TabLinkProps): React.JSX.Element {
  const { tab, studio } = props;
  const label = tab === DEFAULT_TAB ? <Icon id="machine-sanctum/document-type/default" /> : capitalize(tab);
  const uri = tab === DEFAULT_TAB ? 'about:machine-sanctum' : `about:machine-sanctum/${tab}`;

  return (
    <EditorToolbarButton studio={studio} label={label} command="std.editor.focusOrOpenDocument" commandArgs={[uri]} />
  );
}
