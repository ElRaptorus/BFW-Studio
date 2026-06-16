import {
  CATEGORY_LABELS,
  CATEGORY_SEVERITY_ORDER,
  type SanitizableIssue,
  type SanitizerIssueCategory,
  issueDescriptions,
} from '#modules/bpmn-core/sanitizer';
import type { SanitizerBridgeApi } from '#modules/bpmn-core/sanitizer/SanitizerBridge';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { EditorDocument, Studio } from '@evil/bifrost_fw_sdk';

import type BpmnDocumentModel from '../../../BpmnDocumentModel';

type SanitizerInspectorProps = {
  editorDocument: EditorDocument;
  model: BpmnDocumentModel;
  studio: Studio;
};

const SEVERITY_ICONS: Record<string, string> = {
  error: 'ph-fill ph-x-circle',
  warning: 'ph-fill ph-warning',
  info: 'ph-fill ph-info',
};

const SEVERITY_CSS_SUFFIX: Record<string, string> = {
  error: '--error',
  warning: '--warning',
  info: '--info',
};

export function SanitizerInspector(props: SanitizerInspectorProps): React.JSX.Element {
  const { model, studio } = props;
  const [findings, setFindings] = useState<SanitizableIssue[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!model?.modelerAdapter) {
      return;
    }

    const bridge = model.modelerAdapter.getModelerComponentByName<SanitizerBridgeApi>('sanitizerBridge');
    if (!bridge) {
      return;
    }

    const refresh = () => setFindings([...bridge.getFindings()]);
    refresh();

    const interval = setInterval(refresh, 500);
    return () => clearInterval(interval);
  }, [model]);

  const groupedByCategory = useMemo(() => {
    const groups = new Map<SanitizerIssueCategory, SanitizableIssue[]>();
    for (const issue of findings) {
      const existing = groups.get(issue.category);
      if (existing) {
        existing.push(issue);
      } else {
        groups.set(issue.category, [issue]);
      }
    }
    return groups;
  }, [findings]);

  const sortedCategories = useMemo(() => {
    const cats = [...groupedByCategory.keys()];
    cats.sort((catA, catB) => {
      const ai = CATEGORY_SEVERITY_ORDER.indexOf(catA);
      const bi = CATEGORY_SEVERITY_ORDER.indexOf(catB);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
    return cats;
  }, [groupedByCategory]);

  const onFixIssue = useCallback(
    (issue: SanitizableIssue, event: React.MouseEvent) => {
      event.stopPropagation();
      studio.commands.executeCommand('bpmn.sanitizer.fixIssue', [issue]);
    },
    [studio],
  );

  const onFixAll = useCallback(() => {
    studio.commands.executeCommand('bpmn.sanitizer.fixAll');
  }, [studio]);

  const toggleCategory = useCallback((category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  if (findings.length === 0) {
    return (
      <div className="sanitizer-inspector" data-test--sanitizer-inspector>
        <div className="sanitizer-inspector__empty">
          <i className="ph ph-check-circle" />
          <span>No issues found. The BPMN is clean.</span>
        </div>
      </div>
    );
  }

  let globalIndex = 0;

  return (
    <div className="sanitizer-inspector" data-test--sanitizer-inspector>
      <div className="sanitizer-inspector__header">
        <span className="sanitizer-inspector__header-title">Structural Issues</span>
        <div className="sanitizer-inspector__header-actions">
          <button
            className="sanitizer-inspector__header-btn"
            type="button"
            data-test--sanitizer-help-btn
            onClick={() => studio.commands.executeCommand('std.help.openToTheSide', ['bpmn/sanitizer'])}
            title="What is this?"
          >
            <i className="ph ph-question" />
          </button>
          <button
            className="sanitizer-inspector__header-btn"
            type="button"
            data-test--sanitizer-fix-all-btn
            onClick={onFixAll}
            title="Fix all issues"
          >
            <i className="ph ph-broom" />
            Fix All
          </button>
        </div>
      </div>
      <div className="sanitizer-inspector__body">
        {sortedCategories.map((category) => {
          const issues = groupedByCategory.get(category) ?? [];
          const catInfo = CATEGORY_LABELS[category];
          const isCollapsed = collapsedCategories.has(category);
          const startIndex = globalIndex;
          globalIndex += issues.length;

          return (
            <div key={category} className="sanitizer-category" data-test--sanitizer-category={category}>
              <div
                className="sanitizer-category__header"
                role="button"
                tabIndex={0}
                data-test--sanitizer-category-header={category}
                onClick={() => toggleCategory(category)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleCategory(category);
                  }
                }}
              >
                <i className={isCollapsed ? 'ph ph-caret-right' : 'ph ph-caret-down'} />
                <span>
                  {catInfo?.label ?? category} ({issues.length})
                </span>
              </div>
              {!isCollapsed && catInfo?.description && (
                <div className="sanitizer-category__description">{catInfo.description}</div>
              )}
              {!isCollapsed &&
                issues.map((issue, itemIndex) => {
                  const idx = startIndex + itemIndex;
                  const isExpanded = expandedIndex === idx;
                  const desc = issueDescriptions[issue.type];
                  const itemClasses = ['sanitizer-issue', isExpanded ? 'sanitizer-issue--expanded' : '']
                    .filter(Boolean)
                    .join(' ');

                  return (
                    <div
                      key={`${issue.type}-${issue.elementId}`}
                      className={itemClasses}
                      data-test--sanitizer-issue={issue.elementId}
                    >
                      <div
                        className="sanitizer-issue__row"
                        role="button"
                        tabIndex={0}
                        onClick={() => setExpandedIndex((prev) => (prev === idx ? null : idx))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setExpandedIndex((prev) => (prev === idx ? null : idx));
                          }
                        }}
                      >
                        <i
                          className={`sanitizer-issue__severity-icon sanitizer-issue__severity-icon${SEVERITY_CSS_SUFFIX[issue.severity] ?? ''} ${SEVERITY_ICONS[issue.severity] ?? ''}`}
                        />
                        <span className="sanitizer-issue__message">{desc?.message(issue) ?? issue.label}</span>
                        <button
                          className="sanitizer-issue__fix-btn"
                          type="button"
                          data-test--sanitizer-fix-issue-btn={issue.elementId}
                          onClick={(e) => onFixIssue(issue, e)}
                          title="Fix this issue"
                        >
                          <i className="ph-bold ph-broom" />
                        </button>
                      </div>
                      {isExpanded && desc && (
                        <div className="sanitizer-issue__detail">
                          <div className="sanitizer-issue__detail-section">
                            <strong>Why:</strong> {desc.why}
                          </div>
                          <div className="sanitizer-issue__detail-section">
                            <strong>Suggestion:</strong> {desc.suggestion}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
