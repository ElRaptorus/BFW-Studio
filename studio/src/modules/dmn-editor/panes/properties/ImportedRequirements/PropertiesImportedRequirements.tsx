import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';

import React, { useCallback, useEffect, useState } from 'react';

import type { SelectOption, Suggestion } from '@elraptorus/bfw_studio_sdk';
import { PaneProperty } from '@elraptorus/bfw_studio_sdk';

import type DmnDocumentModel from '../../../DmnDocumentModel';
import { DmnElementType } from '../../../DmnElementTypes';
import type { ImportedRequirement, ImportedRequirementType } from '../../../ImportedRequirements';
import { allowedImportedRequirementTypes } from '../../../ImportedRequirements';
import {
  getDmnSelectionForPropertiesPane,
  getKeyForDmnPropertiesPane,
  shouldBeDisplayedForDmnDrdElementOfType,
} from '../../PropertiesPaneFunctions';
import type { DmnSolutionModel } from '../../components/DmnImportLookup';
import { fileNameOf, findImportedModel } from '../../components/DmnImportLookup';
import { DmnJumpLink } from '../../components/DmnJumpLink';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

const TYPE_LABELS: Record<ImportedRequirementType, string> = {
  decision: 'Decision',
  input: 'Input',
  knowledge: 'Knowledge',
};

function getPaneTitle(): string {
  return 'Imported Requirements';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  return (
    shouldBeDisplayedForDmnDrdElementOfType(editorDocument, editorDocumentModel, DmnElementType.Decision) ||
    shouldBeDisplayedForDmnDrdElementOfType(editorDocument, editorDocumentModel, DmnElementType.BusinessKnowledgeModel)
  );
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="dmn/drd" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getDmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }
  return <ImportedRequirementsContent key={getKeyForDmnPropertiesPane(selection)} {...props} />;
}

function elementsOfType(model: DmnSolutionModel, type: ImportedRequirementType) {
  switch (type) {
    case 'decision':
      return model.elements.decisions;
    case 'input':
      return model.elements.inputData;
    case 'knowledge':
      // The Engine resolves knowledge requirements to business knowledge models only (`bkm_not_found` otherwise).
      return model.elements.businessKnowledgeModels;
  }
}

/** Row keys; identical type/namespace/element triples get an occurrence counter so keys stay unique. */
function createRequirementKeys(requirements: ImportedRequirement[]): Map<ImportedRequirement, string> {
  const occurrences = new Map<string, number>();
  return new Map(
    requirements.map((requirement) => {
      const base = `${requirement.type}_${requirement.namespace}_${requirement.elementId}`;
      const occurrence = occurrences.get(base) ?? 0;
      occurrences.set(base, occurrence + 1);
      return [requirement, `${base}_${occurrence}`];
    }),
  );
}

function ImportedRequirementsContent(props: PaneComponentProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as DmnDocumentModel;
  const element = model.selection.getOnlyElementOrNull();
  const [revision, setRevision] = useState(0);
  if (element == null) {
    return null;
  }

  const refresh = (): void => {
    setRevision((previous) => previous + 1);
  };
  const requirements = model.elements.getImportedRequirements(element.id);
  const requirementKeys = createRequirementKeys(requirements);
  const allowedTypes = allowedImportedRequirementTypes(element.businessObject?.$type ?? '');
  const declaredNamespaces: string[] = model.elements
    .getImports()
    .map((importElement: any) => importElement.namespace)
    .filter((namespace: string | undefined): namespace is string => namespace != null && namespace !== '');

  return (
    <PaneBody key={revision}>
      {requirements.length === 0 && (
        <div className="dmn-imports__empty" data-test--dmn-imported-requirements-empty={true}>
          No requirements from imported models.
        </div>
      )}
      {requirements.map((requirement) => (
        <RequirementRow
          key={requirementKeys.get(requirement)}
          studio={props.studio}
          requirement={requirement}
          onRetarget={(targetElementId) => {
            model.elements.retargetImportedRequirement(element.id, requirement, targetElementId);
            refresh();
          }}
          onRemove={() => {
            model.elements.removeImportedRequirement(element.id, requirement);
            refresh();
          }}
        />
      ))}
      <AddRequirementForm
        key={declaredNamespaces.join('|')}
        studio={props.studio}
        allowedTypes={allowedTypes}
        declaredNamespaces={declaredNamespaces}
        onAdd={(type, href) => {
          model.elements.addImportedRequirement(element.id, type, href);
          refresh();
        }}
      />
    </PaneBody>
  );
}

type RequirementRowProps = {
  studio: Bifrost;
  requirement: ImportedRequirement;
  onRetarget: (targetElementId: string) => void;
  onRemove: () => void;
};

function RequirementRow(props: RequirementRowProps): React.JSX.Element {
  const { requirement } = props;
  const [imported, setImported] = useState<DmnSolutionModel | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    findImportedModel(props.studio, requirement.namespace).then((found) => {
      if (!cancelled) {
        setImported(found);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [props.studio, requirement.namespace]);

  const suggestions: Promise<Suggestion[]> = Promise.resolve(
    imported == null
      ? []
      : elementsOfType(imported, requirement.type).map((item) => ({
          label: item.name ?? item.id,
          sublabel: item.id,
          value: item.id,
        })),
  );

  return (
    <div
      className="dmn-imports__entry"
      data-test--dmn-imported-requirement={`${requirement.type}:${requirement.namespace}#${requirement.elementId}`}
    >
      <div className="dmn-imports__requirement-header">
        <strong>{TYPE_LABELS[requirement.type]}</strong>{' '}
        <span title={requirement.namespace}>{imported != null ? fileNameOf(imported.uri) : requirement.namespace}</span>
        {imported === null && (
          <span className="dmn-imports__unresolved" data-test--dmn-imported-requirement-unresolved={true}>
            {' '}
            (no DMN file with this namespace)
          </span>
        )}
      </div>
      <PaneProperty
        key={`${imported?.uri ?? 'unresolved'}_${requirement.elementId}`}
        label={
          <>
            Element{' '}
            {imported != null && (
              <DmnJumpLink studio={props.studio} uri={imported.uri} elementId={requirement.elementId} />
            )}
          </>
        }
        type="text-with-suggestions"
        value={requirement.elementId}
        suggestions={suggestions}
        onCommit={(committed: any) => {
          const value: string = committed?.value ?? committed ?? '';
          if (value !== '' && value !== requirement.elementId) {
            props.onRetarget(value);
          }
        }}
      />
      <div className="dmn-imports__entry-actions">
        <button
          type="button"
          className="dmn-imports__remove-button"
          onClick={props.onRemove}
          data-test--dmn-imported-requirement-remove={true}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

type AddRequirementFormProps = {
  studio: Bifrost;
  allowedTypes: ImportedRequirementType[];
  declaredNamespaces: string[];
  onAdd: (type: ImportedRequirementType, href: string) => void;
};

function AddRequirementForm(props: AddRequirementFormProps): React.JSX.Element {
  const [type, setType] = useState<ImportedRequirementType>(props.allowedTypes[0]);
  const [namespace, setNamespace] = useState<string>(props.declaredNamespaces[0] ?? '');
  const [elementId, setElementId] = useState('');
  const [imported, setImported] = useState<DmnSolutionModel | null>(null);

  useEffect(() => {
    let cancelled = false;
    findImportedModel(props.studio, namespace).then((found) => {
      if (!cancelled) {
        setImported(found);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [props.studio, namespace]);

  const typeOptions: SelectOption[] = props.allowedTypes.map((allowed) => ({
    label: TYPE_LABELS[allowed],
    value: allowed,
  }));
  const namespaceOptions: SelectOption[] = props.declaredNamespaces.map((declared) => ({
    label: declared,
    value: declared,
  }));
  const elementSuggestions: Promise<Suggestion[]> = Promise.resolve(
    imported == null
      ? []
      : elementsOfType(imported, type).map((item) => ({
          label: item.name ?? item.id,
          sublabel: item.id,
          value: item.id,
        })),
  );

  const add = useCallback(() => {
    if (namespace !== '' && elementId !== '') {
      props.onAdd(type, `${namespace}#${elementId}`);
    }
  }, [props, type, namespace, elementId]);

  if (props.declaredNamespaces.length === 0) {
    return (
      <div className="dmn-imports__empty" data-test--dmn-imported-requirements-no-imports={true}>
        Declare an import in the Imports pane first.
      </div>
    );
  }

  return (
    <div className="dmn-imports__entry" data-test--dmn-imported-requirement-add-form={true}>
      {typeOptions.length > 1 && (
        <PaneProperty
          label="Requirement type"
          type="select"
          options={typeOptions}
          value={typeOptions.find((option) => option.value === type) ?? typeOptions[0]}
          onChange={(option: SelectOption) => {
            setType(option.value);
            setElementId('');
          }}
          htmlId="dmn-imported-requirement-type"
        />
      )}
      <PaneProperty
        label="Imported model"
        type="select"
        options={namespaceOptions}
        value={namespaceOptions.find((option) => option.value === namespace) ?? namespaceOptions[0]}
        onChange={(option: SelectOption) => {
          setNamespace(option.value);
          setElementId('');
        }}
        htmlId="dmn-imported-requirement-namespace"
      />
      <PaneProperty
        key={`${namespace}_${type}_${imported?.uri ?? ''}`}
        label="Element"
        type="text-with-suggestions"
        value={elementId}
        placeholder="Pick or type an element ID..."
        suggestions={elementSuggestions}
        onCommit={(committed: any) => setElementId(committed?.value ?? committed ?? '')}
        htmlId="dmn-imported-requirement-element"
      />
      <div className="dmn-imports__actions">
        <button
          type="button"
          className="dmn-imports__add-button"
          onClick={add}
          disabled={elementId === ''}
          data-test--dmn-imported-requirement-add={true}
        >
          + Add imported requirement
        </button>
      </div>
    </div>
  );
}
