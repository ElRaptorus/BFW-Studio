import React from 'react';

import type { PaneComponentProps } from '@evil/bifrost_fw_sdk';
import {
  MultiLineCodeEditor,
  OpenInNewTabButton,
  PaneBody,
  assertNotNull,
  buildSimplePropertyPaneProvider,
} from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { shouldDisplayProcessInstanceErrorPane } from '../ShouldBeDisplayedConditions';

type ProcessInstanceErrorPaneProps = PaneComponentProps & {
  editorDocumentModel: EngineBpmnDebuggerEditorDocumentModel;
};

export const paneProvider = buildSimplePropertyPaneProvider(
  shouldDisplayProcessInstanceErrorPane,
  'Error',
  ProcessInstanceErrorPane,
  (props: PaneComponentProps) => {
    const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
    const fatalErrors = collectFatalFlowNodeErrors(model);
    const piError = model.processInstance?.errorInfo ?? null;

    assertNotNull(model.processInstance, 'processInstance');

    const combinedErrors: Record<string, unknown> = {};
    if (piError != null) {
      combinedErrors.processInstanceError = piError;
    }
    if (fatalErrors.length > 0) {
      combinedErrors.flowNodeErrors = fatalErrors;
    }
    const serializedError = JSON.stringify(combinedErrors, null, 2);

    return (
      <>
        <button
          className="btn btn-sm btn-secondary flow-node-props__information-header--copy-button"
          onClick={() => navigator.clipboard.writeText(serializedError)}
        >
          Copy
        </button>{' '}
        <OpenInNewTabButton
          studio={props.studio}
          type="engine-debug.process-json-property"
          parentUri={props.editorDocument.uri}
          fragmentId={`${model.processInstance.id}-error`}
          additionalData={{
            processInstanceId: model.processInstance.id,
            processModelId: model.processInstance.processModelId,
            propertyName: 'Error',
            value: serializedError,
          }}
          dataTest="open-process-instance-error-in-new-tab"
        />
      </>
    );
  },
);

function collectFatalFlowNodeErrors(model: EngineBpmnDebuggerEditorDocumentModel): Record<string, unknown>[] {
  return model.flowNodeInstances
    .filter((instance) => instance.errorInfo != null)
    .map((instance) => ({
      flowNodeInstanceId: instance.id,
      flowNodeId: instance.flowNodeId,
      errorInfo: instance.errorInfo,
    }));
}

function ProcessInstanceErrorPane(props: ProcessInstanceErrorPaneProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;

  assertNotNull(model.processInstance, 'processInstance');

  const piError = model.processInstance.errorInfo ?? null;

  const fatalErrors = collectFatalFlowNodeErrors(model).map((entry) => ({
    flowNodeInstanceId: entry.flowNodeInstanceId,
    flowNodeId: entry.flowNodeId,
    ...(entry.errorInfo as Record<string, unknown>),
  }));

  const combinedOutput: Record<string, unknown> = {};
  if (piError != null) {
    combinedOutput.processInstanceError = piError;
  }
  if (fatalErrors.length > 0) {
    combinedOutput.flowNodeErrors = fatalErrors;
  }

  return (
    <PaneBody>
      <MultiLineCodeEditor
        studio={props.studio}
        htmlId="debugger-process-instance-error-property"
        size="tall"
        fontSize={12}
        initialValue={JSON.stringify(combinedOutput, null, 2)}
        readOnly={true}
        language="json"
      />
    </PaneBody>
  );
}
