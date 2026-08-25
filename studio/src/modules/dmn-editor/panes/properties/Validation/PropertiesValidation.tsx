import React, { useEffect, useState } from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneBody, PaneHeader, PaneHeaderHelpIcon } from '@evil/bifrost_fw_sdk';

import type { DmnViolation } from '../../../../dmn-core/validation/DmnValidator';
import type DmnDocumentModel from '../../../DmnDocumentModel';
import { EVENT_DMN_VALIDATION_UPDATED } from '../../../DmnValidationOverlayManager';
import { getDmnModel, isDmnDocument } from '../../PropertiesPaneFunctions';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(): string {
  return 'Validation';
}

function shouldBeDisplayed(editorDocument: EditorDocument, _editorDocumentModel: EditorDocumentModel): boolean {
  return isDmnDocument(editorDocument);
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const model = getDmnModel(props.editorDocumentModel);
  const validationManager = model?.validationManager;
  const errorCount = validationManager?.getErrorCount() ?? 0;
  const warningCount = validationManager?.getWarningCount() ?? 0;
  const totalCount = errorCount + warningCount;
  const badgeText = totalCount > 0 ? ` (${totalCount})` : '';

  return (
    <Pane>
      <PaneHeader
        studio={props.studio}
        title={`${getPaneTitle()}${badgeText}`}
        paneId={props.paneId}
        collapsed={props.collapsed}
      >
        <PaneHeaderHelpIcon studio={props.studio} id="dmn/editor" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const model = getDmnModel(props.editorDocumentModel);
  if (!model || !model.isReadyForInteraction()) {
    return null;
  }

  return <ValidationContent {...props} />;
}

function ValidationContent(props: PaneComponentProps): React.JSX.Element {
  const model = props.editorDocumentModel as DmnDocumentModel;
  const [violations, setViolations] = useState<DmnViolation[]>(() => model.validationManager?.getViolations() ?? []);

  useEffect(() => {
    const validationManager = model.validationManager;
    if (!validationManager) {
      return;
    }

    const subscription = validationManager.on(EVENT_DMN_VALIDATION_UPDATED, (updatedViolations: DmnViolation[]) => {
      setViolations([...updatedViolations]);
    });

    return () => {
      subscription.dispose();
    };
  }, [model]);

  const errors = violations.filter((violation) => violation.severity === 'error');
  const warnings = violations.filter((violation) => violation.severity === 'warning');

  if (violations.length === 0) {
    return (
      <PaneBody>
        <div className="dmn-validation__clean" data-test--dmn-validation-clean={true}>
          No validation issues found.
        </div>
      </PaneBody>
    );
  }

  const groupedByElement = groupViolationsByElement(violations);

  return (
    <PaneBody>
      <div className="dmn-validation__summary" data-test--dmn-validation-summary={true}>
        {errors.length > 0 && (
          <span className="dmn-validation__error-count">
            {errors.length} error{errors.length !== 1 ? 's' : ''}
          </span>
        )}
        {errors.length > 0 && warnings.length > 0 && <span>, </span>}
        {warnings.length > 0 && (
          <span className="dmn-validation__warning-count">
            {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="dmn-validation__list" data-test--dmn-validation-list={true}>
        {[...groupedByElement.entries()].map(([elementKey, elementViolations]) => {
          const firstViolation = elementViolations[0];
          const elementLabel =
            firstViolation.elementName || firstViolation.elementId || firstViolation.elementType || 'Unknown';

          return (
            <ViolationGroup
              key={elementKey}
              elementLabel={elementLabel}
              elementType={firstViolation.elementType}
              violations={elementViolations}
              model={model}
            />
          );
        })}
      </div>
    </PaneBody>
  );
}

type ViolationGroupProps = {
  elementLabel: string;
  elementType: string;
  violations: DmnViolation[];
  model: DmnDocumentModel;
};

function ViolationGroup(props: ViolationGroupProps): React.JSX.Element {
  const { elementLabel, elementType, violations, model } = props;

  const navigateToElement = (elementId: string): void => {
    if (!elementId) {
      return;
    }
    try {
      model.zoomToElement(elementId);
      model.selection.selectElement(elementId);
    } catch {
      // Element may not be visible in current view
    }
  };

  return (
    <div className="dmn-validation__group" data-test--dmn-validation-group={elementLabel}>
      <div className="dmn-validation__group-header">
        <span className="dmn-validation__group-type">{elementType}</span>
        <span className="dmn-validation__group-name">{elementLabel}</span>
      </div>
      {violations.map((violation) => (
        <div
          key={`${violation.elementId}_${violation.category}_${violation.message}`}
          className={`dmn-validation__violation dmn-validation__violation--${violation.severity}`}
          data-test--dmn-validation-violation={true}
          onClick={() => navigateToElement(violation.elementId)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              navigateToElement(violation.elementId);
            }
          }}
        >
          <span className={`dmn-validation__severity-icon dmn-validation__severity-icon--${violation.severity}`}>
            {violation.severity === 'error' ? '●' : '▲'}
          </span>
          <span className="dmn-validation__message">{violation.message}</span>
        </div>
      ))}
    </div>
  );
}

function groupViolationsByElement(violations: DmnViolation[]): Map<string, DmnViolation[]> {
  const grouped = new Map<string, DmnViolation[]>();
  for (const violation of violations) {
    const key = violation.elementId || violation.elementType || 'global';
    const existing = grouped.get(key) ?? [];
    existing.push(violation);
    grouped.set(key, existing);
  }
  return grouped;
}
