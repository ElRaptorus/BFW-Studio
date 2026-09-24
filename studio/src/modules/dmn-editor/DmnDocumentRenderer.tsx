import type { Bifrost } from '#bifrost/Bifrost';
import type { AbstractSubscription } from '#bifrost/common/AbstractEmitter';
import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocumentRendererProps } from '#bifrost/contracts/EditorTypes';
import { Checkbox } from '#components/Checkbox';
import { showContextMenu } from '#components/ContextMenuFunctions';
import { Icon } from '#components/Icon';
import { Editor } from '#components/editor/Editor';
import { EditorContent } from '#components/editor/EditorContent';
import { EditorLoadingError } from '#components/editor/EditorLoadingError';
import { EditorTitle } from '#components/editor/EditorTitle';
import { EditorTitleText } from '#components/editor/EditorTitleText';
import { EditorToolbar } from '#components/editor/EditorToolbar';
import { EditorToolbarButton } from '#components/editor/EditorToolbarButton';
import { EditorToolbarLeft } from '#components/editor/EditorToolbarLeft';
import { EditorToolbarRight } from '#components/editor/EditorToolbarRight';
import 'diagram-js-minimap/assets/diagram-js-minimap.css';
import 'dmn-js/dist/assets/diagram-js.css';
import 'dmn-js/dist/assets/dmn-font/css/dmn-embedded.css';
import 'dmn-js/dist/assets/dmn-js-boxed-expression-controls.css';
import 'dmn-js/dist/assets/dmn-js-boxed-expression.css';
import 'dmn-js/dist/assets/dmn-js-decision-table-controls.css';
import 'dmn-js/dist/assets/dmn-js-decision-table.css';
import 'dmn-js/dist/assets/dmn-js-drd.css';
import 'dmn-js/dist/assets/dmn-js-literal-expression.css';
import 'dmn-js/dist/assets/dmn-js-shared.css';

import React from 'react';

import type { DmnView } from '../dmn-core/DmnModelerComponentAdapter';
import { EVENT_DMN_ADAPTER_VIEW_CHANGED } from '../dmn-core/DmnModelerComponentAdapter';
import type DmnDocumentModel from './DmnDocumentModel';
import { DMN_DOCUMENT_TYPE } from './index';
import './styles/dmn-editor.scss';
import './styles/dmn.scss';

type DmnDocumentRendererState = {
  errorWhileLoading: Error | null;
  isInteractive: boolean;
  views: DmnView[];
  activeViewType: string | null;
};

export default class DmnDocumentRenderer extends React.Component<
  EditorDocumentRendererProps,
  DmnDocumentRendererState
> {
  private dmnDocumentModel: DmnDocumentModel | null;
  private settingsSubscription: AbstractSubscription | null = null;
  private refDmnModeler: React.RefObject<HTMLDivElement | null>;
  private refLoadingIndicator: React.RefObject<HTMLDivElement | null>;

  constructor(props: EditorDocumentRendererProps) {
    super(props);

    this.refDmnModeler = React.createRef();
    this.refLoadingIndicator = React.createRef();
    this.dmnDocumentModel = null;

    this.state = {
      errorWhileLoading: null,
      isInteractive: false,
      views: [],
      activeViewType: null,
    };
  }

  async componentDidMount(): Promise<void> {
    try {
      this.dmnDocumentModel = await this.props.studio.editors.getEditorDocumentModel<DmnDocumentModel>(
        this.props.editorDocument,
      );

      this.forceUpdate();

      this.dmnDocumentModel?.onceInteractive(() => {
        this.setState({
          isInteractive: true,
          views: this.dmnDocumentModel?.modelerAdapter.getViews() ?? [],
          activeViewType: this.dmnDocumentModel?.getActiveViewType() ?? null,
        });
      });

      this.dmnDocumentModel?.modelerAdapter.on(
        EVENT_DMN_ADAPTER_VIEW_CHANGED,
        (viewData: { views: DmnView[]; activeView: DmnView | null }) => {
          this.setState({
            views: viewData.views,
            activeViewType: viewData.activeView?.type ?? null,
          });
        },
      );

      const model = this.dmnDocumentModel;
      this.settingsSubscription =
        model == null
          ? null
          : this.props.studio.settings.onDidChange(
              (settingName: string) => {
                if (settingName === 'dmn.editor.showGrid') {
                  this.forceUpdate();
                }
              },
              () => model.getUri(),
            );

      this.attachDmnDocument();
    } catch (error) {
      this.setState({ errorWhileLoading: error as Error });
    }
  }

  componentWillUnmount(): void {
    this.settingsSubscription?.dispose();
    this.settingsSubscription = null;
  }

  render(): React.JSX.Element {
    const bifrost = this.props.studio;
    const cmd = bifrost.commands.getClickHandler();

    if (
      this.state.errorWhileLoading?.message?.includes('unresolved merge conflicts') ||
      this.props.editorDocument.metadata?.mergeConflict
    ) {
      return this.renderUnresolvedMergeConflictsError(bifrost);
    }

    if (this.state.errorWhileLoading != null) {
      return (
        <Editor>
          <EditorLoadingError errorMessage={this.state.errorWhileLoading} />
        </Editor>
      );
    }

    const isDrd = this.state.activeViewType === 'drd';

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
                sublabel="The file was changed from outside Studio. An attempt was made to reload the file, but the XML could not be parsed. You can bring the file to a working state by saving this editor."
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
                sublabel="The file was changed from outside Studio."
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
                        this.dmnDocumentModel?.renameCurrentFile(
                          this.props.editorDocument.metadata.fileRenamedFromOutside,
                        )
                      }
                    >
                      Click here
                    </a>{' '}
                    to update this document to the new filename.
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
              command={`std.editor.showExportDialog.${DMN_DOCUMENT_TYPE}`}
              commandArgs={[this.dmnDocumentModel]}
            />
            {bifrost.commands.isRegistered('git.showGitDiff') && (
              <EditorToolbarButton
                key="git-cruiser/show-diff"
                studio={this.props.studio}
                icon="ph ph-git-diff"
                tooltip="Visually compare the diagram against the last commit"
                label="Show Diff"
                command="git.showGitDiff"
                commandArgs={[this.props.editorDocument.uri]}
              />
            )}
            {bifrost.commands.isRegistered('git.showFileHistory') && (
              <EditorToolbarButton
                key="git-cruiser/show-history"
                studio={this.props.studio}
                icon="git-cruiser/history"
                tooltip="Browse commit history for this diagram"
                label="History"
                command="git.showFileHistory"
                commandArgs={[this.props.editorDocument.uri]}
              />
            )}
          </EditorToolbarLeft>
          <EditorToolbarRight>
            {isDrd && (
              <Checkbox
                checked={this.dmnDocumentModel?.showGrid}
                onChange={cmd('dmn.editor.toggleShowGrid')}
                label="Show Grid"
              />
            )}
            {isDrd && (
              <EditorToolbarButton
                studio={bifrost}
                icon="ph ph-arrows-in"
                tooltip="Zoom to viewport"
                label="Zoom to viewport"
                command="std.editor.zoomToViewport"
                commandArgs={[this.props.editorDocument]}
              />
            )}
          </EditorToolbarRight>
        </EditorToolbar>

        {this.state.views.length > 1 && this.renderViewSwitcher()}

        <EditorContent ref={this.refDmnModeler}>
          <div
            className="editor-loading__backdrop"
            ref={this.refLoadingIndicator}
            data-test--dmn-document-is-interactive={this.state.isInteractive}
          >
            <div className="editor-loading__content ph-3x">
              <Icon id="ph-light ph-gear ph-spin" />
            </div>
          </div>
        </EditorContent>
      </Editor>
    );
  }

  private renderViewSwitcher(): React.JSX.Element {
    return (
      <div className="dmn-view-switcher">
        {this.state.activeViewType !== 'drd' && (
          <div
            className="dmn-view-switcher__back-button"
            data-test--dmn-view-switcher-back="true"
            onClick={() => this.dmnDocumentModel?.modelerAdapter.openDrd()}
          >
            <Icon id="ph ph-arrow-left" />
            Back to DRD
          </div>
        )}
        {this.state.views.map((view) => (
          <div
            key={view.id}
            className={`dmn-view-switcher__item ${
              this.state.activeViewType === view.type &&
              view.id === this.dmnDocumentModel?.modelerAdapter.getActiveView()?.id
                ? 'dmn-view-switcher__item--active'
                : ''
            }`}
            data-test--dmn-view-switcher-item={view.id}
            onClick={() => this.dmnDocumentModel?.modelerAdapter.openView(view)}
          >
            <Icon id={this.getViewTypeIcon(view.type)} />
            {view.name || this.getViewTypeLabel(view.type)}
          </div>
        ))}
      </div>
    );
  }

  private getViewTypeIcon(type: string): string {
    switch (type) {
      case 'drd':
        return 'ph ph-graph';
      case 'decisionTable':
        return 'ph ph-table';
      case 'literalExpression':
        return 'ph ph-code';
      case 'boxedExpression':
        return 'ph ph-brackets-curly';
      default:
        return 'ph ph-file';
    }
  }

  private getViewTypeLabel(type: string): string {
    switch (type) {
      case 'drd':
        return 'DRD';
      case 'decisionTable':
        return 'Decision Table';
      case 'literalExpression':
        return 'Literal Expression';
      case 'boxedExpression':
        return 'Boxed Expression';
      default:
        return type;
    }
  }

  private renderUnresolvedMergeConflictsError(studio: Bifrost): React.JSX.Element {
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

  private attachDmnDocument(): void {
    assertNotNull(this.refDmnModeler.current, 'this.refDmnModeler.current');
    assertNotNull(this.dmnDocumentModel, 'this.dmnDocumentModel');

    this.dmnDocumentModel.attachToHtmlElement(this.refDmnModeler.current);
    this.initializeContextMenuForDmnElements();
    this.hideLoadingIndicator();
  }

  private initializeContextMenuForDmnElements(): void {
    assertNotNull(this.refDmnModeler.current, 'this.refDmnModeler.current');

    const findClickedElementId = (clickedElement: HTMLElement): string | undefined => {
      let currentElement = clickedElement;
      let stopParentTraversal = false;
      while (!stopParentTraversal) {
        stopParentTraversal = currentElement.nodeName === 'SVG' || currentElement.dataset.elementId != null;

        if (!stopParentTraversal) {
          if (currentElement.parentElement == null) {
            return undefined;
          }
          currentElement = currentElement.parentElement;
        }
      }

      return currentElement?.dataset?.elementId;
    };

    this.refDmnModeler.current.addEventListener('contextmenu', (event: MouseEvent) => {
      if (this.dmnDocumentModel?.getActiveViewType() !== 'drd') {
        return;
      }

      const clickedElement = event.target as HTMLElement;
      const elementId = findClickedElementId(clickedElement);

      if (elementId != null) {
        void showContextMenu(event, 'dmn/element', [elementId]);
      }
    });
  }

  private hideLoadingIndicator(): void {
    assertNotNull(this.dmnDocumentModel, 'this.dmnDocumentModel');

    this.dmnDocumentModel.onceInteractive(() => {
      if (this.refLoadingIndicator.current != null) {
        this.refLoadingIndicator.current.style.display = 'none';
      }
    });
  }
}
