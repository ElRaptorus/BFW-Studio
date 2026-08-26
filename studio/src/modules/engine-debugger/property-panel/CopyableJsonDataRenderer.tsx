import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import { MultiLineCodeEditor } from '#components/MultiLineCodeEditor';
import { OpenInNewTabButton } from '#components/OpenInNewTabButton';
import type { ErrorInfo } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import { PaneProperty } from '@evil/bifrost_fw_sdk';

export type CopyableJsonDataRendererProps = {
  editorDocument: EditorDocument;
  id: string;
  flowNodeId: string;
  flowNodeName?: string;
  propertyName: string;
  formattedHeader?: string | React.JSX.Element;
  size?: 'small' | 'medium' | 'tall';
  language?: 'json' | 'javascript';
  studio: Bifrost;
  value: unknown;
};

export type FlowNodeErrorRendererProps = {
  editorDocument: EditorDocument;
  id: string;
  flowNodeId: string;
  flowNodeName?: string;
  studio: Bifrost;
  error: ErrorInfo | Error | Record<string, unknown> | null;
};

export function CopyableFlowNodeErrorRenderer(props: FlowNodeErrorRendererProps): React.JSX.Element {
  const errorRecord = props.error;
  const errorMessage =
    errorRecord != null && typeof errorRecord === 'object' && 'message' in errorRecord
      ? String((errorRecord as { message?: unknown }).message ?? '')
      : '';

  return (
    <div>
      {errorMessage !== '' && <PaneProperty type="text" label="Error" disabled={true} value={errorMessage} />}
      {errorRecord != null ? (
        <CopyableJsonDataRenderer
          id={props.id}
          flowNodeId={props.flowNodeId}
          flowNodeName={props.flowNodeName ?? props.flowNodeId}
          editorDocument={props.editorDocument}
          propertyName="Error Details:"
          value={errorRecord}
          studio={props.studio}
          size="medium"
        />
      ) : null}
    </div>
  );
}

export function CopyableJsonDataRenderer(props: CopyableJsonDataRendererProps): React.JSX.Element {
  const stringifiedValue = typeof props.value !== 'string' ? JSON.stringify(props.value, null, 2) : props.value;

  return (
    <div className="mb-2">
      <div className="flow-node-props__information-header">
        <span className="flow-node-props__information-header--text">{props.formattedHeader || props.propertyName}</span>
        <div className="flow-node-props__information-header--controls">
          <button
            className="btn btn-sm btn-secondary flow-node-props__information-header--copy-button"
            onClick={() => navigator.clipboard.writeText(stringifiedValue)}
          >
            Copy
          </button>{' '}
          <OpenInNewTabButton
            studio={props.studio}
            type="engine-debug.json-property"
            parentUri={props.editorDocument.uri}
            fragmentId={`${props.id}-${props.propertyName}`}
            additionalData={{
              id: props.id,
              flowNodeId: props.flowNodeId,
              flowNodeName: props.flowNodeName ?? props.flowNodeId,
              propertyName: props.propertyName,
              value: stringifiedValue,
              scriptLanguage: props.language || 'json',
            }}
            dataTest="open-flow-node-instance-json-property-in-new-tab"
          />
        </div>
      </div>
      <div>
        <MultiLineCodeEditor
          studio={props.studio}
          htmlId="debugger-flow-node-instance-json-property"
          size={props.size || 'tall'}
          fontSize={12}
          initialValue={stringifiedValue}
          readOnly={true}
          language={props.language || 'json'}
        />
      </div>
    </div>
  );
}
