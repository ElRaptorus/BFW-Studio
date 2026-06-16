import React, { useState } from 'react';

import type { EditorDocumentRendererProps } from '@evil/bifrost_fw_sdk';
import { Editor, EditorContent, EditorToolbar, EditorToolbarLeft, EditorToolbarText } from '@evil/bifrost_fw_sdk';

import { ActionsEditor } from './ActionsEditor';
import { FormBuilderPreview } from './FormBuilderPreview';
import './FormBuilderRenderer.scss';
import { FormCanvas } from './FormCanvas';
import { ToolboxSidebar } from './ToolboxSidebar';
import { useBpmnFormBuilderState } from './useBpmnFormBuilderState';

type ViewMode = 'design' | 'preview';

export default function FormBuilderRenderer(props: EditorDocumentRendererProps): React.JSX.Element | null {
  const state = useBpmnFormBuilderState(props);
  const [viewMode, setViewMode] = useState<ViewMode>('design');

  if (state.loading) {
    return <div className="form-builder-renderer form-builder-renderer--loading">Loading...</div>;
  }

  return (
    <Editor>
      <EditorToolbar>
        <EditorToolbarLeft>
          <EditorToolbarText studio={props.studio}>
            Form Builder for User Task &quot;
            <a href="#" onClick={state.navigateToParent}>
              {state.fragmentName}
            </a>
            &quot; ({state.fragmentId}) in{' '}
            <a href="#" onClick={state.navigateToParent}>
              {state.parentDocumentLabel}
            </a>
          </EditorToolbarText>
        </EditorToolbarLeft>
      </EditorToolbar>
      <EditorContent>
        <div className="form-builder-renderer">
          <header className="form-builder-renderer__toolbar">
            <div className="form-builder-renderer__tabs">
              <button
                type="button"
                className={`form-builder-renderer__tab${viewMode === 'design' ? ' form-builder-renderer__tab--active' : ''}`}
                data-test--form-builder-tab-design
                onClick={() => setViewMode('design')}
              >
                Design
              </button>
              <button
                type="button"
                className={`form-builder-renderer__tab${viewMode === 'preview' ? ' form-builder-renderer__tab--active' : ''}`}
                data-test--form-builder-tab-preview
                onClick={() => setViewMode('preview')}
              >
                Preview
              </button>
            </div>
            <span className="form-builder-renderer__title">{state.fragmentName}</span>
          </header>

          {viewMode === 'design' && (
            <div className="form-builder-renderer__body">
              <ToolboxSidebar state={state} />
              <div className="form-builder-renderer__center">
                <FormCanvas state={state} />
                <ActionsEditor state={state} />
              </div>
            </div>
          )}

          {viewMode === 'preview' && (
            <div className="form-builder-renderer__preview">
              <FormBuilderPreview state={state} />
            </div>
          )}
        </div>
      </EditorContent>
    </Editor>
  );
}
