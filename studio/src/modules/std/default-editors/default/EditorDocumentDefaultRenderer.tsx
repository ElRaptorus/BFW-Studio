import React from 'react';

import {
  Editor,
  EditorContent,
  type EditorDocumentRendererProps,
  MultiLineCodeEditor,
  type Studio,
  assertNotNull,
} from '@evil/bifrost_fw_sdk';

import type { EditorDocumentDefaultModel } from './EditorDocumentDefaultModel';

export class EditorDocumentDefaultRenderer extends React.Component<EditorDocumentRendererProps, any> {
  private studio: Studio;
  private model: EditorDocumentDefaultModel | null = null;

  constructor(props: EditorDocumentRendererProps) {
    super(props);
    this.studio = props.studio;
  }

  async componentDidMount(): Promise<void> {
    this.model = await this.studio.editors.getEditorDocumentModel(this.props.editorDocument);
    this.forceUpdate();
  }

  private onDataChanged(value: string): void {
    // This is one of those situations where the TypeScript compiler complains about `this.model` possibly being `null`,
    // but you know this can't possibly be `null` because this method can only ever be called if the model is present.
    //
    // `assertNotNull` provides a utility function to both appease the compiler and give you the peace of mind that
    // if - for some unforeseen reason or future implementation change - `this.model` is `null` at this point, we fail
    // early and with a descriptive error message (which is why this is preferable to the bang operator).
    assertNotNull(this.model, 'this.model');

    this.model.setValue(value);
  }

  render(): React.JSX.Element | null {
    if (this.model == null) {
      return null;
    }

    return (
      <Editor>
        <EditorContent>
          <MultiLineCodeEditor
            studio={this.studio}
            className="pane__textarea"
            initialValue={this.model.getValue()}
            lineNumbers={true}
            language="json"
            onChange={(value: string) => this.onDataChanged(value)}
            autoFocus={true}
          />
        </EditorContent>
      </Editor>
    );
  }
}
