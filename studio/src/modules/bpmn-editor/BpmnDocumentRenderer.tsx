import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'diagram-js-minimap/assets/diagram-js-minimap.css';

import React from 'react';

import type { EditorDocumentRendererProps, Studio } from '@evil/bifrost_fw_sdk';
import {
  Checkbox,
  Editor,
  EditorContent,
  EditorLoadingError,
  EditorTitle,
  EditorTitleText,
  EditorToolbar,
  EditorToolbarButton,
  EditorToolbarLeft,
  EditorToolbarMenu,
  EditorToolbarRight,
  Icon,
  assertNotNull,
  showContextMenu,
} from '@evil/bifrost_fw_sdk';

import type { AbstractSubscription } from '../../../../studio-sdk/src/common/AbstractEmitter';
import { EVENT_BPMN_MODELER_ADAPTER_ROOT_CHANGED } from '../bpmn-core/BpmnModelerComponentAdapter';
import {
  getHumanReadableTextForDataObjectSetting,
  showAllDataObjectDetails,
} from '../bpmn-core/DataObjectDetailsSettings';
import type BpmnDocumentModel from './BpmnDocumentModel';
import { BPMN_DOCUMENT_TYPE } from './index';
import './styles/bpmn-breadcrumb-bar.scss';

export default class BpmnDocumentRenderer extends React.Component<EditorDocumentRendererProps, any> {
  private bpmnEditorDocumentModel: BpmnDocumentModel | null;
  private refBpmnModeler: React.RefObject<HTMLDivElement | null>;
  private refLoadingIndicator: React.RefObject<HTMLDivElement | null>;
  private rootChangedSubscription: AbstractSubscription | null = null;

  constructor(props: EditorDocumentRendererProps) {
    super(props);

    this.refBpmnModeler = React.createRef();
    this.refLoadingIndicator = React.createRef();
    this.bpmnEditorDocumentModel = null;

    this.state = { errorWhileLoading: null, isInteractive: false };
  }

  async componentDidMount(): Promise<void> {
    try {
      this.bpmnEditorDocumentModel = await this.props.studio.editors.getEditorDocumentModel<BpmnDocumentModel>(
        this.props.editorDocument,
      );

      this.forceUpdate();

      this.bpmnEditorDocumentModel?.onceInteractive(() => {
        this.setState({ isInteractive: true });
      });

      this.rootChangedSubscription = this.bpmnEditorDocumentModel.modelerAdapter.on(
        EVENT_BPMN_MODELER_ADAPTER_ROOT_CHANGED,
        () => this.forceUpdate(),
      );

      this.attachBpmnDocument();
    } catch (error) {
      this.setState({ errorWhileLoading: error });
    }
  }

  componentWillUnmount(): void {
    this.rootChangedSubscription?.dispose();
    this.rootChangedSubscription = null;
  }

  render(): React.JSX.Element {
    const bifrost = this.props.studio;
    const cmd = bifrost.commands.getClickHandler();

    if (
      this.state.errorWhileLoading?.message?.includes('unresolved merge conflicts') ||
      this.props.editorDocument.metadata?.errorOnReloadingFile?.message.includes('unresolved merge conflicts')
    ) {
      return this.renderUnresolvedMergeConflitsError(bifrost);
    }

    if (this.state.errorWhileLoading != null) {
      return (
        <Editor>
          <EditorLoadingError errorMessage={this.state.errorWhileLoading} />
        </Editor>
      );
    }

    return (
      <Editor>
        <EditorTitle>
          {this.props.editorDocument.metadata?.removedFromFileSystem && (
            <>
              <div className="editor-title__icon editor-title__icon--warning">
                <Icon id="ph ph-warning" />
              </div>

              <EditorTitleText
                studio={bifrost}
                label="Error: File does not exist"
                sublabel="The file was moved, deleted or renamed from outside Studio. You can bring the file to a working state by saving this editor."
              />
            </>
          )}
          {this.props.editorDocument.metadata?.errorOnReloadingFile && (
            <>
              <div className="editor-title__icon editor-title__icon--warning">
                <Icon id="ph ph-warning" />
              </div>

              <EditorTitleText
                studio={bifrost}
                label="Error while reloading the file"
                sublabel="The file was changed from outside Studio. An attempt was made to reload the file, but the XML could not be
            parsed. You can bring the file to a working state by saving this editor."
              />
            </>
          )}
          {this.props.editorDocument.metadata?.fileChangedFromOutside && (
            <>
              <div className="editor-title__icon editor-title__icon--warning">
                <Icon id="ph ph-warning" />
              </div>

              <EditorTitleText
                studio={bifrost}
                label="File was changed"
                sublabel={
                  <>
                    The file was changed from outside Studio.{' '}
                    <a
                      href="#"
                      onClick={bifrost.commands.getClickHandler()('bpmn.diff.openDiffCurrentDataVsOriginalData', [
                        this.props.editorDocument,
                      ])}
                    >
                      Click here
                    </a>{' '}
                    to view the diffs between your changes and the new data of the file.
                  </>
                }
              />
            </>
          )}
          {this.props.editorDocument.metadata?.fileRenamedFromOutside && (
            <>
              <div className="editor-title__icon editor-title__icon--warning">
                <Icon id="ph ph-warning" />
              </div>

              <EditorTitleText
                studio={bifrost}
                label="File was renamed"
                sublabel={
                  <>
                    The file was renamed to <b>{this.props.editorDocument.metadata.fileRenamedFromOutside}</b> from
                    outside Studio.{' '}
                    <a
                      href="#"
                      onClick={() =>
                        this.bpmnEditorDocumentModel?.renameCurrentFile(
                          this.props.editorDocument.metadata.fileRenamedFromOutside,
                        )
                      }
                    >
                      Click here
                    </a>{' '}
                    to update this document to the new filename or save this document to create a file with the current
                    (<b>{this.bpmnEditorDocumentModel?.getCurrentFilename()}</b>) filename.
                  </>
                }
              />
            </>
          )}
        </EditorTitle>
        <EditorToolbar>
          <EditorToolbarLeft>
            <EditorToolbarButton
              studio={this.props.studio}
              label="Export as..."
              icon="ph-duotone ph-export"
              command={`std.editor.showExportDialog.${BPMN_DOCUMENT_TYPE}`}
              commandArgs={[this.bpmnEditorDocumentModel]}
            />
            <EditorToolbarButton
              key="git-cruiser/show-diff"
              studio={this.props.studio}
              icon="ph ph-git-diff"
              tooltip="Visually compare the diagram against the last commit"
              label="Show Diff"
              command="git.showGitDiff"
              commandArgs={[this.props.editorDocument.uri]}
            />

            <EditorToolbarButton
              key="git-cruiser/show-history"
              studio={this.props.studio}
              icon="git-cruiser/history"
              tooltip="Browse commit history for this diagram"
              label="History"
              command="git.showFileHistory"
              commandArgs={[this.props.editorDocument.uri]}
            />
          </EditorToolbarLeft>
          <EditorToolbarRight>
            <Checkbox
              studio={this.props.studio}
              checked={this.bpmnEditorDocumentModel?.showGrid}
              onChange={cmd('bpmn.editor.toggleShowGrid')}
              label="Show Grid"
            />
            <EditorToolbarMenu
              studio={bifrost}
              icon="ph-duotone ph-arrow-line-down"
              tooltip="Arrange selected elements"
              label="Arrange"
              menuId="bpmn/editor-toolbar/alignment"
            />{' '}
            <EditorToolbarButton
              studio={bifrost}
              icon="ph ph-arrows-in"
              tooltip="Zoom to viewport"
              label="Zoom to viewport"
              command="std.editor.zoomToViewport"
              commandArgs={[this.props.editorDocument]}
            />
          </EditorToolbarRight>
        </EditorToolbar>

        {this.renderBreadcrumbBar()}

        <EditorContent ref={this.refBpmnModeler}>
          <div
            className="editor-loading__backdrop"
            ref={this.refLoadingIndicator}
            data-test--bpmn-document-is-interactive={this.state.isInteractive}
          >
            <div className="editor-loading__content ph-3x">
              <Icon id="ph-light ph-gear ph-spin" />
            </div>
          </div>
          {this.bpmnEditorDocumentModel &&
            !showAllDataObjectDetails(this.bpmnEditorDocumentModel.dataObjectDetailLevel) && (
              <div
                className="hidden-data-object-elements-hint"
                data-bs-title={`Data Object visibility level is set to '${getHumanReadableTextForDataObjectSetting(
                  this.bpmnEditorDocumentModel.dataObjectDetailLevel,
                )}'`}
                data-bs-toggle="tooltip"
              >
                <Icon id="ph ph-eye-slash" />
              </div>
            )}
        </EditorContent>
      </Editor>
    );
  }

  private renderBreadcrumbBar(): React.JSX.Element | null {
    if (this.bpmnEditorDocumentModel == null || !this.bpmnEditorDocumentModel.elements.isInsideSubprocessPlane()) {
      return null;
    }

    const chain = this.buildBreadcrumbChain();
    if (chain.length === 0) {
      return null;
    }

    return (
      <div className="bpmn-breadcrumb-bar" data-test--bpmn-breadcrumb-bar="true">
        {chain.map((entry, index) => {
          const isLast = index === chain.length - 1;
          return (
            <React.Fragment key={entry.id}>
              {index > 0 && (
                <span className="bpmn-breadcrumb-bar__separator">
                  <Icon id="ph ph-caret-right" />
                </span>
              )}
              <div
                className={`bpmn-breadcrumb-bar__item${isLast ? ' bpmn-breadcrumb-bar__item--active' : ''}`}
                onClick={isLast ? undefined : () => this.navigateToPlane(entry.targetSubprocessId)}
              >
                {index === 0 && <Icon id="ph ph-arrow-left" />}
                {entry.label}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  private buildBreadcrumbChain(): { id: string; label: string; targetSubprocessId: string | null }[] {
    if (this.bpmnEditorDocumentModel == null) {
      return [];
    }

    const canvas = this.bpmnEditorDocumentModel.modelerAdapter.getCanvas();
    const currentRoot = canvas.getRootElement();
    if (currentRoot == null) {
      return [];
    }

    const chain: { id: string; label: string; targetSubprocessId: string | null }[] = [];
    let businessObject = currentRoot.businessObject;

    while (businessObject != null) {
      const name = businessObject.name || businessObject.id;
      const type = businessObject.$type;

      if (type === 'bpmn:SubProcess') {
        chain.unshift({ id: businessObject.id, label: name, targetSubprocessId: businessObject.id });
      } else if (type === 'bpmn:Process') {
        chain.unshift({ id: businessObject.id, label: name, targetSubprocessId: null });
      }

      businessObject = businessObject.$parent;
    }

    return chain;
  }

  private navigateToPlane(targetSubprocessId: string | null): void {
    if (this.bpmnEditorDocumentModel == null) {
      return;
    }

    const canvas = this.bpmnEditorDocumentModel.modelerAdapter.getCanvas();

    if (targetSubprocessId != null) {
      const targetRoot = canvas.findRoot(`${targetSubprocessId}_plane`);
      if (targetRoot != null) {
        canvas.setRootElement(targetRoot);
      }
      return;
    }

    const roots = canvas.getRootElements();
    const mainRoot = roots.find(
      (root: any) => root.businessObject != null && root.businessObject.$type !== 'bpmn:SubProcess',
    );
    if (mainRoot != null) {
      canvas.setRootElement(mainRoot);
    }
  }

  private renderUnresolvedMergeConflitsError(studio: Studio): React.JSX.Element {
    return (
      <Editor>
        <EditorToolbar>
          {studio.commands.isRegistered('git.merge.openResolver') && (
            <EditorToolbarButton
              key="git-cruiser/open-merge-resolver"
              studio={studio}
              icon="ph ph-git-merge"
              label="Open Merge Resolver"
              tooltip="Open the merge conflict resolver to compare and resolve changes"
              command="git.merge.openResolver"
            />
          )}
        </EditorToolbar>
        <EditorContent>
          <EditorLoadingError
            title="Merge conflicts must be resolved"
            subtitle="The diagram cannot be displayed because the file contains Git conflict markers. Use the Merge Resolver to compare both versions and choose which changes to keep."
          />
        </EditorContent>
      </Editor>
    );
  }

  private attachBpmnDocument(): void {
    assertNotNull(this.refBpmnModeler.current, 'this.refBpmnModeler.current');
    assertNotNull(this.bpmnEditorDocumentModel, 'this.bpmnDocument');

    this.bpmnEditorDocumentModel.attachToHtmlElement(this.refBpmnModeler.current);
    this.initializeContextMenuForBpmnElements();
    this.hideLoadingIndicator();
  }

  private initializeContextMenuForBpmnElements(): void {
    assertNotNull(this.refBpmnModeler.current, 'this.refBpmnModeler.current');

    const diagramJsSvgRootElement: HTMLElement | null =
      this.refBpmnModeler.current.querySelector('.djs-container > svg');

    const findClickedBpmnElement = (clickedElement: HTMLElement): string | undefined => {
      let currentElement = clickedElement;
      let stopParentTraversal = false;
      while (!stopParentTraversal) {
        stopParentTraversal = currentElement.nodeName === 'SVG' || currentElement.dataset.elementId != null;

        if (!stopParentTraversal) {
          assertNotNull(currentElement.parentElement, 'element.parentElement');
          currentElement = currentElement.parentElement;
        }
      }

      return currentElement?.dataset?.elementId;
    };

    if (diagramJsSvgRootElement != null) {
      diagramJsSvgRootElement.addEventListener('contextmenu', (event: MouseEvent) => {
        // TODO: not sure how to avoid this `as` casting
        const clickedElement = event.target as HTMLElement;
        const elementId = findClickedBpmnElement(clickedElement);

        if (elementId != null) {
          showContextMenu(event, 'bpmn/element', [elementId]);
        } else {
          throw new Error('Could not find SVG element for BPMN contextMenu');
        }
      });
    } else {
      throw new Error('No SVG element to initialize BPMN contextMenu.');
    }
  }

  private hideLoadingIndicator(): void {
    assertNotNull(this.bpmnEditorDocumentModel, 'this.bpmnEditorDocumentModel');

    this.bpmnEditorDocumentModel.onceInteractive(() => {
      if (this.refLoadingIndicator.current != null) {
        this.refLoadingIndicator.current.style.display = 'none';
      }
    });
  }
}
