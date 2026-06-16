import { FormRenderer } from '#modules/bpmn-core/form-renderer';

import React from 'react';

import type { FormBuilderState } from './useBpmnFormBuilderState';

type FormBuilderPreviewProps = {
  state: FormBuilderState;
};

export function FormBuilderPreview(props: FormBuilderPreviewProps): React.JSX.Element {
  const { state } = props;

  return (
    <div className="form-builder-preview">
      <FormRenderer
        fields={state.fields}
        actions={state.actions}
        title={state.fragmentName}
        readOnly={false}
        onSubmit={() => {
          // Preview mode: no-op
        }}
        onCancel={() => {
          // Preview mode: no-op
        }}
      />
    </div>
  );
}
