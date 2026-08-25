import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider, Studio } from '@evil/bifrost_fw_sdk';
import { Icon, Pane, PaneBody, PaneHeader, PaneHeaderIcon } from '@evil/bifrost_fw_sdk';
import type { BpmnDocumentModel } from '@evil/bifrost_fw_sdk/types/BpmnDocumentModel';

import type { LintBridgeApi, LintFinding, LintSeverity } from '../types';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: ProblemsPaneFull,
  PaneContent: ProblemsPaneContent,
};

function getPaneTitle(): string {
  return 'Findings';
}

function shouldBeDisplayed(editorDocument: EditorDocument, _editorDocumentModel: unknown, studio: Studio): boolean {
  if (!editorDocument || editorDocument.documentType !== 'bpmn') {
    return false;
  }
  if (!studio) {
    return false;
  }
  return studio.settings.get('bpmnLinter.enabled') === true;
}

function ProblemsPaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderIcon
          studio={props.studio}
          icon="ph ph-export"
          tooltip="Export findings as JSON"
          command="bpmn.linter.exportFindings"
        />
      </PaneHeader>
      {props.collapsed !== true && <ProblemsPaneContent {...props} />}
    </Pane>
  );
}

function ProblemsPaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const [findings, setFindings] = useState<LintFinding[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);

  const model = props.editorDocumentModel as BpmnDocumentModel | null;

  useEffect(() => {
    if (!model?.modelerAdapter) {
      return;
    }

    const bridge = model.modelerAdapter.getModelerComponentByName<LintBridgeApi>('lintBridge');
    if (!bridge) {
      return;
    }

    const handler = () => {
      setFindings([...bridge.getFindings()]);
      setSelectedElementIds([...bridge.getSelectedElementIds()]);
    };

    handler();
    const interval = setInterval(handler, 500);
    return () => clearInterval(interval);
  }, [model]);

  const groupedFindings = useMemo(() => {
    const errors = findings.filter((finding) => finding.severity === 'error');
    const warnings = findings.filter((finding) => finding.severity === 'warning');
    const infos = findings.filter((finding) => finding.severity === 'info');
    return { errors, warnings, infos };
  }, [findings]);

  const onFindingClick = useCallback(
    (finding: LintFinding, index: number, shiftKey: boolean) => {
      if (finding.elementId && model?.modelerAdapter) {
        const bridge = model.modelerAdapter.getModelerComponentByName<LintBridgeApi>('lintBridge');
        bridge?.selectElement(finding.elementId, shiftKey);
      }
      if (!shiftKey) {
        setExpandedIndex((prev) => (prev === index ? null : index));
      }
    },
    [model],
  );

  const onFindingMouseEnter = useCallback(
    (finding: LintFinding) => {
      if (finding.elementId && model?.modelerAdapter) {
        const bridge = model.modelerAdapter.getModelerComponentByName<LintBridgeApi>('lintBridge');
        bridge?.highlightElement(finding.elementId);
      }
    },
    [model],
  );

  const onFindingMouseLeave = useCallback(
    (finding: LintFinding) => {
      if (finding.elementId && model?.modelerAdapter) {
        const bridge = model.modelerAdapter.getModelerComponentByName<LintBridgeApi>('lintBridge');
        bridge?.unhighlightElement(finding.elementId);
      }
    },
    [model],
  );

  if (findings.length === 0) {
    return (
      <PaneBody>
        <div className="lint-problems-empty">
          <Icon id="bpmn-linter/badge/check" />
          <span>No problems found</span>
        </div>
      </PaneBody>
    );
  }

  let globalIndex = 0;

  return (
    <PaneBody>
      <div className="lint-problems-list">
        {groupedFindings.errors.length > 0 && (
          <FindingGroup
            severity="error"
            findings={groupedFindings.errors}
            startIndex={globalIndex}
            expandedIndex={expandedIndex}
            selectedElementIds={selectedElementIds}
            onFindingClick={onFindingClick}
            onFindingMouseEnter={onFindingMouseEnter}
            onFindingMouseLeave={onFindingMouseLeave}
          />
        )}
        {(() => {
          globalIndex += groupedFindings.errors.length;
          return null;
        })()}

        {groupedFindings.warnings.length > 0 && (
          <FindingGroup
            severity="warning"
            findings={groupedFindings.warnings}
            startIndex={globalIndex}
            expandedIndex={expandedIndex}
            selectedElementIds={selectedElementIds}
            onFindingClick={onFindingClick}
            onFindingMouseEnter={onFindingMouseEnter}
            onFindingMouseLeave={onFindingMouseLeave}
          />
        )}
        {(() => {
          globalIndex += groupedFindings.warnings.length;
          return null;
        })()}

        {groupedFindings.infos.length > 0 && (
          <FindingGroup
            severity="info"
            findings={groupedFindings.infos}
            startIndex={globalIndex}
            expandedIndex={expandedIndex}
            selectedElementIds={selectedElementIds}
            onFindingClick={onFindingClick}
            onFindingMouseEnter={onFindingMouseEnter}
            onFindingMouseLeave={onFindingMouseLeave}
          />
        )}
      </div>
    </PaneBody>
  );
}

type FindingGroupProps = {
  severity: LintSeverity;
  findings: LintFinding[];
  startIndex: number;
  expandedIndex: number | null;
  selectedElementIds: string[];
  onFindingClick: (finding: LintFinding, index: number, shiftKey: boolean) => void;
  onFindingMouseEnter: (finding: LintFinding) => void;
  onFindingMouseLeave: (finding: LintFinding) => void;
};

const SEVERITY_ICONS: Record<LintSeverity, string> = {
  error: 'bpmn-linter/severity/error',
  warning: 'bpmn-linter/severity/warning',
  info: 'bpmn-linter/severity/info',
};

const SEVERITY_LABELS: Record<LintSeverity, string> = {
  error: 'Errors',
  warning: 'Warnings',
  info: 'Info',
};

function FindingGroup(props: FindingGroupProps): React.JSX.Element {
  const {
    severity,
    findings,
    startIndex,
    expandedIndex,
    selectedElementIds,
    onFindingClick,
    onFindingMouseEnter,
    onFindingMouseLeave,
  } = props;

  return (
    <div className={`lint-problems-group lint-problems-group--${severity}`}>
      <div className="lint-problems-group__header">
        <Icon id={SEVERITY_ICONS[severity]} />
        <span>
          {findings.length} {SEVERITY_LABELS[severity]}
        </span>
      </div>
      {findings.map((finding, itemIndex) => {
        const globalIdx = startIndex + itemIndex;
        const isExpanded = expandedIndex === globalIdx;
        const isSelected = finding.elementId != null && selectedElementIds.includes(finding.elementId);

        const itemClasses = [
          'lint-problems-item',
          isExpanded ? 'lint-problems-item--expanded' : '',
          isSelected ? 'lint-problems-item--selected' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <div key={`${finding.ruleId}-${finding.elementId}-${finding.message}`} className={itemClasses}>
            <button
              className="lint-problems-item__row"
              type="button"
              onClick={(event) => onFindingClick(finding, globalIdx, event.shiftKey)}
              onMouseEnter={() => onFindingMouseEnter(finding)}
              onMouseLeave={() => onFindingMouseLeave(finding)}
            >
              {itemIndex + 1}.
              <span className="lint-problems-item__element">
                {finding.elementName || finding.elementId || 'Process'}
              </span>
              <span className="lint-problems-item__message">{finding.message}</span>
            </button>
            {isExpanded && (
              <div className="lint-problems-item__detail">
                {finding.why && (
                  <div className="lint-problems-item__detail-section">
                    <strong>Why:</strong> {finding.why}
                  </div>
                )}
                {finding.suggestion && (
                  <div className="lint-problems-item__detail-section">
                    <strong>Suggestion:</strong> {finding.suggestion}
                  </div>
                )}
                <div className="lint-problems-item__detail-rule">Rule: {finding.ruleId}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
