import type { Studio } from '@evil/bifrost_fw_sdk';

import { EditorDocumentDefaultModel } from '../default-editors/default/EditorDocumentDefaultModel';
import { EditorDocumentDefaultRenderer } from '../default-editors/default/EditorDocumentDefaultRenderer';
import { EditorDocumentMarkdownEditorInspector } from '../default-editors/mdx/EditorDocumentMarkdownEditorInspector';
import { EditorDocumentMarkdownEditorModel } from '../default-editors/mdx/EditorDocumentMarkdownEditorModel';
import { EditorDocumentMarkdownEditorRenderer } from '../default-editors/mdx/EditorDocumentMarkdownEditorRenderer';

export function initializeEditorDocuments(studio: Studio): void {
  studio.icons.registerIcons({
    'editor-document-markdown-editor': 'ph ph-markdown-logo markdown-editor__tab-icon',
    'editor-document-default-editor': 'ph ph-brackets-curly default-editor__tab-icon',
  });

  studio.editors.registerDocumentType('editor-document-markdown-editor', {
    uriMatch: /\.(mdx?|mdc|markdown|mdown|mkd|mkdn)$/i,
    rendererKey: 'EditorDocumentMarkdownEditorRenderer',
    rendererConstructor: EditorDocumentMarkdownEditorRenderer,
    modelKey: 'EditorDocumentMarkdownEditorModel',
    modelConstructor: EditorDocumentMarkdownEditorModel,
    icon: 'editor-document-markdown-editor',
    inspectorKey: 'EditorDocumentMarkdownEditorInspector',
    inspectorConstructor: EditorDocumentMarkdownEditorInspector,
  });

  studio.solution.registerDefaultIncludedFiles(['**/*.md', '**/*.mdx', '**/*.mdc']);

  studio.editors.registerDocumentType('editor-document-default-editor', {
    uriMatch: /^editor:default$/,
    rendererKey: 'EditorDocumentDefaultRenderer',
    rendererConstructor: EditorDocumentDefaultRenderer,
    modelKey: 'EditorDocumentDefaultModel',
    modelConstructor: EditorDocumentDefaultModel,
    icon: 'editor-document-default-editor',
  });
}
