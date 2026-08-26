import type { Bifrost } from '#bifrost/Bifrost';
import { Icon } from '#components/Icon';
import { EditorContent } from '#components/editor/EditorContent';

import React from 'react';

export default function EditorResponsiveness(props: any): React.JSX.Element {
  const bifrost: Bifrost = props.bifrost;
  const cmd = bifrost.commands.getClickHandler();

  const shouldDisplayButton = props.editorDocument.uri == 'about:machine-sanctum/responsiveness';
  const code = `
.editor--xs {
  /* This is always applied */
}
.editor--sm {
  /* This is applied once the editor is small */
  /* All declarations for "xs" editors are applied as well */
}
.editor--md {
  /* This is applied once the editor is medium-sized */
  /* All declarations for "xs" and "sm" editors are applied as well */
}
.editor--l {
  /* This is applied once the editor is large */
  /* All declarations for "xs", "sm" and "md" editors are applied as well */
}
`;
  return (
    <EditorContent>
      <div className="machine-sanctum-theme-demo">
        <h2>Editor Responsiveness</h2>
        {shouldDisplayButton ? (
          <p>
            <button
              className="btn btn-primary"
              onClick={cmd('std.editor.openDocumentToTheSide', ['about:machine-sanctum/responsiveness2'])}
            >
              Open second editor
            </button>
          </p>
        ) : (
          <p>
            <Icon id="ph-fill ph-arrow-left" /> Resize the split editors by dragging the border between them.
          </p>
        )}

        <div className="demo-label"></div>

        <p>
          Editor contents can be displayed in a responsive way by utilizing special CSS classes, which work like
          Breakpoints in Media Queries:
        </p>
        <pre>{code}</pre>
        <p>
          The available classes are: <code>.editor--xs</code>, <code>.editor--sm</code>, <code>.editor--md</code>,{' '}
          <code>.editor--l</code>, <code>.editor--xl</code> and <code>.editor--xxl</code>.
        </p>

        <div className="machine-sanctum-subpage__hero-icon">
          <Icon id="ph-duotone ph-cloud-moon" />
        </div>
      </div>
    </EditorContent>
  );
}
