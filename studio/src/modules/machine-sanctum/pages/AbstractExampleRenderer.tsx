import type { Bifrost } from '#bifrost/Bifrost';
import type { AbstractSubscription } from '#bifrost/common/AbstractEmitter';
import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import { MultiLineCodeEditor } from '#components/MultiLineCodeEditor';

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
};

export abstract class AbstractExampleRenderer<TRendererProps> extends React.Component<
  AbstractExampleRendererProps & TRendererProps,
  AbstractExampleRendererState
> {
  protected bifrost: Bifrost;

  private codeEditor: MultiLineCodeEditor | null = null;
  private model: MachineSanctumDocumentModel | null = null;
  private appliedSavedExampleData = false;

  private subscriptions: AbstractSubscription[];

  constructor(props: AbstractExampleRendererProps & TRendererProps) {
    super(props);

    this.bifrost = props.bifrost;
    this.subscriptions = [];

    this.state = {
      originalData: props.data,
      currentData: props.data,
      valueIsValid: true,
    };
  }

  async componentDidMount(): Promise<void> {
    this.model = await this.props.bifrost.editors.getEditorDocumentModel(this.props.editorDocument);
    assertNotNull(this.model, 'this.model');
    this.applySavedExampleDataIfNeeded();
  }

  componentWillUnmount(): void {
    this.subscriptions.forEach((subscription) => subscription.dispose());
  }

  abstract render(): React.JSX.Element;

  protected abstract getEditorLanguage(): string;

  protected abstract valueIsValid(value: any): boolean;

  protected abstract getDataForModel(data: any): any;

  protected abstract getDataForRenderer(data: any): string;

  protected renderCodeEditor(): React.JSX.Element {
    return (
      <MultiLineCodeEditor
        studio={this.bifrost}
        initialValue={this.getDataForRenderer(this.state.originalData)}
        language={this.getEditorLanguage()}
        lineNumbers={true}
        liveUpdate={true}
        onChange={(value) => this.handleCodeChanged(value)}
        ref={(instance) => {
          this.codeEditor = instance;
          this.applySavedExampleDataIfNeeded();
        }}
      />
    );
  }

  protected resetExampleData(): void {
    assertNotNull(this.model, 'this.model');
    assertNotNull(this.codeEditor, 'this.codeEditor');

    this.setState({ currentData: this.props.data, valueIsValid: true });

    const originalDataAsString = this.getDataForRenderer(this.state.originalData);
    this.codeEditor.setValue(originalDataAsString);
    this.model.resetExampleData(this.props.viewMediatorId);
  }

  private handleCodeChanged(value: string): void {
    if (this.model == null) {
      return;
    }

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
        valueIsValid: this.valueIsValid(value),
      });
    } else {
      this.model.resetExampleData(this.props.viewMediatorId);
    }
  }

  private applySavedExampleDataIfNeeded(): void {
    if (this.appliedSavedExampleData || this.model == null || this.codeEditor == null) {
      return;
    }

    const exampleData = this.model.getExampleData(this.props.viewMediatorId);
    const originalDataAsString = this.getDataForRenderer(this.state.originalData);
    const dataWasChanged = exampleData != null && exampleData.data !== originalDataAsString;

    if (!dataWasChanged) {
      this.appliedSavedExampleData = true;
      return;
    }

    this.codeEditor.setValue(exampleData.data);
    this.appliedSavedExampleData = true;

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
