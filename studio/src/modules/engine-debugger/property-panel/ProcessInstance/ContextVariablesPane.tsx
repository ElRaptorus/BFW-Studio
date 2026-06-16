import React from 'react';

import type { PaneComponentProps } from '@evil/bifrost_fw_sdk';
import {
  MultiLineCodeEditor,
  OpenInNewTabButton,
  PaneBody,
  buildSimplePropertyPaneProvider,
} from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { shouldDisplayProcessModelInfoPane } from '../ShouldBeDisplayedConditions';

export const paneProvider = buildSimplePropertyPaneProvider(
  shouldDisplayProcessModelInfoPane,
  'Context Variables',
  ContextVariablesPane,
  (props: PaneComponentProps) => {
    const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
    if (!model.processInstance) {
      return null;
    }

    const startedWithContext = model.processInstance.startedWithContext;
    if (isContextEmpty(startedWithContext)) {
      return null;
    }

    const stringifiedValue = JSON.stringify(startedWithContext, null, 2);

    return (
      <OpenInNewTabButton
        studio={props.studio}
        type="engine-debug.json-property"
        parentUri={props.editorDocument.uri}
        fragmentId={`${model.processInstance.id}-context-variables`}
        additionalData={{
          propertyName: 'Context Variables',
          value: stringifiedValue,
        }}
        dataTest="open-process-instance-context-variables-in-new-tab"
      />
    );
  },
);

function isContextEmpty(context: Record<string, unknown> | null | undefined): boolean {
  if (context == null) {
    return true;
  }
  return Object.keys(context).length === 0;
}

function ContextVariablesPane(props: PaneComponentProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  if (!model.processInstance) {
    return null;
  }

  const startedWithContext = model.processInstance.startedWithContext;

  if (isContextEmpty(startedWithContext)) {
    return (
      <PaneBody>
        <p className="text-muted">No context variables were provided when this process instance was started.</p>
      </PaneBody>
    );
  }

  const stringifiedValue = JSON.stringify(startedWithContext, null, 2);

  return (
    <PaneBody>
      <MultiLineCodeEditor
        studio={props.studio}
        htmlId="debugger-process-instance-context-variables-property"
        size="tall"
        fontSize={12}
        initialValue={stringifiedValue}
        readOnly={true}
        language="json"
      />
    </PaneBody>
  );
}
