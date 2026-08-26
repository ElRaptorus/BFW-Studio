import type { Bifrost } from '#bifrost/Bifrost';
import type { MDXEditorMethods } from '@mdxeditor/editor';
import * as globalMarkdownEditor from '@mdxeditor/editor';

import React from 'react';

export type MarkdownEditorAttributes = MDXEditorMethods;

export type MarkdownEditorProps = {
  htmlAttributes?: any;
  readonly?: boolean;
  className?: string;
  data: string;
  onDataChanged?: (value: string) => void;
  studio: Bifrost;
  toolbar?: 'full' | 'compact';
  ref?: React.Ref<MarkdownEditorAttributes>;
};

export function MarkdownEditor({ ref, ...props }: MarkdownEditorProps): React.JSX.Element {
  const studioThemeClasses = props.studio.theme.isCurrentThemeDark()
    ? 'documentation-mdx-editor dark-editor dark-theme'
    : 'documentation-mdx-editor';

  const mdxEditorClassNames = `${studioThemeClasses} ${props.className}`;

  const onChangeWrapper = (value: string) => {
    if (!props.onDataChanged) {
      return;
    }
    const parsedContent = value
      .replace(/\\`/g, '`')
      .replace(/\\{/g, '{')
      .replace(/\\}/g, '}')
      .replace(/\\</g, '<')
      .replace(/\\>/g, '>');
    props.onDataChanged(parsedContent);
  };

  const parsedMarkdownContent = props.data
    .replace(/`/g, '\\`')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/</g, '\\<')
    .replace(/>/g, '\\>');

  function renderFullToolbar(): React.JSX.Element {
    return (
      <>
        <globalMarkdownEditor.BoldItalicUnderlineToggles />
        <span className="block-type-select">
          <globalMarkdownEditor.BlockTypeSelect />
        </span>
        <globalMarkdownEditor.ListsToggle />
        <globalMarkdownEditor.CreateLink />
        <globalMarkdownEditor.CodeToggle />
        <globalMarkdownEditor.InsertCodeBlock />
        <globalMarkdownEditor.InsertThematicBreak />
        <globalMarkdownEditor.InsertTable />
        <globalMarkdownEditor.UndoRedo />
      </>
    );
  }

  function renderCompactToolbar(): React.JSX.Element {
    return (
      <>
        <globalMarkdownEditor.BoldItalicUnderlineToggles />
        <span className="block-type-select">
          <globalMarkdownEditor.BlockTypeSelect />
        </span>
        <globalMarkdownEditor.UndoRedo />
      </>
    );
  }

  const toolbarPreset = props.toolbar ?? 'full';
  const toolbarPlugin = props.readonly
    ? []
    : [
        globalMarkdownEditor.toolbarPlugin({
          toolbarContents: toolbarPreset === 'compact' ? renderCompactToolbar : renderFullToolbar,
        }),
      ];

  return (
    <div {...props.htmlAttributes}>
      <globalMarkdownEditor.MDXEditor
        ref={ref}
        markdown={parsedMarkdownContent}
        onChange={(value) => onChangeWrapper(value)}
        className={mdxEditorClassNames}
        contentEditableClassName="documentation-mdx-editor__content"
        readOnly={props.readonly}
        plugins={[
          globalMarkdownEditor.headingsPlugin(),
          globalMarkdownEditor.listsPlugin(),
          globalMarkdownEditor.quotePlugin(),
          globalMarkdownEditor.thematicBreakPlugin(),
          globalMarkdownEditor.markdownShortcutPlugin(),
          globalMarkdownEditor.linkPlugin(),
          globalMarkdownEditor.linkDialogPlugin(),
          globalMarkdownEditor.tablePlugin(),
          globalMarkdownEditor.codeBlockPlugin({ defaultCodeBlockLanguage: 'js' }),
          globalMarkdownEditor.codeMirrorPlugin({ codeBlockLanguages: { js: 'JavaScript' } }),
          ...toolbarPlugin,
        ]}
      />
    </div>
  );
}
