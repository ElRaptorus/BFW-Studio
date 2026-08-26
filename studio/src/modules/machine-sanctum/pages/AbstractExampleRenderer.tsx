import type { Bifrost } from '#bifrost/Bifrost';
import type { AbstractSubscription } from '#bifrost/common/AbstractEmitter';
import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import { EVENT_THEME_CHANGED } from '#bifrost/contracts/internal/ThemeEvents';
import MonacoEditor, { type OnMount } from '@monaco-editor/react';
import type * as monaco from 'monaco-editor';

import React from 'react';

import type MachineSanctumDocumentModel from '../MachineSanctumDocumentModel';

type AbstractExampleRendererProps = {
  bifrost: Bifrost;
  data: any;
  editorDocument: EditorDocument;
  viewMediatorId: string;
};

type AbstractExampleRendererState = {
  originalData: any;
  currentData: any;
  valueIsValid: boolean;
  monacoTheme: string;
};

export abstract class AbstractExampleRenderer<TRendererProps> extends React.Component<
  AbstractExampleRendererProps & TRendererProps,
  AbstractExampleRendererState
> {
  protected bifrost: Bifrost;

  private editorInstance: monaco.editor.IStandaloneCodeEditor | null = null;
  private model: MachineSanctumDocumentModel | null = null;

  private subscriptions: AbstractSubscription[];

  constructor(props: AbstractExampleRendererProps & TRendererProps) {
    super(props);

    this.bifrost = props.bifrost;

    this.subscriptions = [
      this.bifrost.theme.on(EVENT_THEME_CHANGED, () => {
        this.setState({ monacoTheme: this.getMonacoTheme() });
      }),
    ];

    this.state = {
      originalData: props.data,
      currentData: props.data,
      valueIsValid: true,
      monacoTheme: this.getMonacoTheme(),
    };
  }

  async componentDidMount(): Promise<void> {
    this.model = await this.props.bifrost.editors.getEditorDocumentModel(this.props.editorDocument);
    assertNotNull(this.model, 'this.model');

    const exampleData = this.model.getExampleData(this.props.viewMediatorId);
    const originalDataAsString = this.getDataForRenderer(this.state.originalData);
    const dataWasChanged = exampleData != null && exampleData.data !== originalDataAsString;

    if (dataWasChanged && this.editorInstance) {
      this.editorInstance.setValue(exampleData.data);

      if (exampleData.valueIsValid) {
        this.setState({
          currentData: this.getDataForModel(exampleData.data),
          valueIsValid: exampleData.valueIsValid,
        });
      } else {
        this.setState({ valueIsValid: exampleData.valueIsValid });
      }
    }
  }

  componentWillUnmount(): void {
    this.subscriptions.forEach((subscription) => subscription.dispose());
  }

  abstract render(): React.JSX.Element;

  protected abstract getMonacoLanguage(): string;

  protected abstract valueIsValid(value: any): boolean;

  protected abstract getDataForModel(data: any): any;

  protected abstract getDataForRenderer(data: any): string;

  protected renderMonacoEditor(): React.JSX.Element {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          <MonacoEditor
            defaultValue={this.getDataForRenderer(this.state.originalData)}
            language={this.getMonacoLanguage()}
            theme={this.state.monacoTheme}
            options={{
              automaticLayout: true,
              fontFamily: 'SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace',
              fontSize: 14,
              lineNumbers: 'on',
            }}
            onMount={this.handleEditorDidMount}
          />
        </div>
      </div>
    );
  }

  protected resetExampleData(): void {
    assertNotNull(this.model, 'this.model');
    assertNotNull(this.editorInstance, 'this.editorInstance');

    this.setState({ currentData: this.props.data, valueIsValid: true });

    const originalDataAsString = this.getDataForRenderer(this.state.originalData);

    this.editorInstance.setValue(originalDataAsString);
    this.model.resetExampleData(this.props.viewMediatorId);
  }

  private handleEditorDidMount: OnMount = (editor) => {
    this.editorInstance = editor;

    editor.onDidChangeModelContent(() => {
      assertNotNull(this.model, 'this.model');

      const value = editor.getValue();

      if (this.valueIsValid(value)) {
        this.setState({ currentData: this.getDataForModel(value), valueIsValid: true });
      } else {
        this.setState({ valueIsValid: false });
      }

      const originalDataAsString = this.getDataForRenderer(this.state.originalData);
      const dataWasChanged = value !== originalDataAsString;

      if (dataWasChanged) {
        this.model.setExampleData(this.props.viewMediatorId, {
          data: value,
          valueIsValid: this.state.valueIsValid,
        });
      } else {
        this.model.resetExampleData(this.props.viewMediatorId);
      }
    });

    // Apply any data changes that occurred during componentDidMount (before editor was ready)
    if (this.model) {
      const exampleData = this.model.getExampleData(this.props.viewMediatorId);
      const originalDataAsString = this.getDataForRenderer(this.state.originalData);
      const dataWasChanged = exampleData != null && exampleData.data !== originalDataAsString;

      if (dataWasChanged) {
        editor.setValue(exampleData.data);

        if (exampleData.valueIsValid) {
          this.setState({
            currentData: this.getDataForModel(exampleData.data),
            valueIsValid: exampleData.valueIsValid,
          });
        } else {
          this.setState({ valueIsValid: exampleData.valueIsValid });
        }
      }
    }
  };

  private getMonacoTheme(): string {
    return this.bifrost.theme.isCurrentThemeDark() ? 'vs-dark' : 'vs-light';
  }
}
