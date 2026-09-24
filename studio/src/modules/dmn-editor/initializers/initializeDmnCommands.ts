import type { Bifrost } from '#bifrost/Bifrost';
import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { DialogOptions } from '#bifrost/contracts/DialogTypes';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { FileOrDirectory } from '#bifrost/contracts/FileSystemTypes';
import * as path from 'path';

import type DmnDocumentModel from '../DmnDocumentModel';
import { DMN_DOCUMENT_TYPE } from '../index';

export type ProjectDmnModel = {
  definitionsId: string;
  name: string;
  filename: string;
};

export type ProjectDmnDecision = {
  decisionId: string;
  name: string;
};

export function initializeDmnCommands(bifrost: Bifrost): void {
  bifrost.commands.register(
    'dmn.editor.newDmnDocument',
    () => bifrost.editors.createNewEditorDocumentAsBuffer(DMN_DOCUMENT_TYPE, ''),
    {
      visibleInSearch: true,
      description: ['Editor: New DMN document', 'New DMN file'],
    },
  );

  bifrost.commands.register<ProjectDmnModel[]>('dmn.project.getAllReachableDmnModels', async () => {
    const symbols = await bifrost.symbolIndex.getAll({ type: 'dmn:Definitions' });

    const seenIds = new Set<string>();
    const models: ProjectDmnModel[] = [];

    for (const symbol of symbols) {
      if (seenIds.has(symbol.id)) {
        continue;
      }
      seenIds.add(symbol.id);

      const isLocalFileName = bifrost.files.isLocalFilename(symbol.uri);
      const filename = isLocalFileName ? bifrost.files.getLocalBasename(symbol.uri) : symbol.label;

      models.push({
        definitionsId: symbol.id,
        name: symbol.name ?? symbol.id,
        filename,
      });
    }

    return models.sort((left, right) => left.definitionsId.localeCompare(right.definitionsId));
  });

  bifrost.commands.register<ProjectDmnDecision[]>(
    'dmn.project.getAllDecisionsForDmnModel',
    async (definitionsId: string) => {
      const symbols = await bifrost.symbolIndex.getAll({ type: 'dmn:Decision', definitionId: definitionsId });

      return symbols
        .map((symbol) => ({
          decisionId: symbol.id,
          name: symbol.name ?? symbol.id,
        }))
        .sort((left, right) => left.decisionId.localeCompare(right.decisionId));
    },
  );

  bifrost.commands.register('std.editor.showExportDialog.dmn', async () => {
    const editorDocument = bifrost.editors.getFocusedEditorDocument();
    assertNotNull(editorDocument, 'editorDocument');

    const dialogOptions: DialogOptions = {
      title: 'Export DMN as ...',
      content: [
        {
          type: 'response_link',
          label: 'SVG',
          sublabel: 'DRD as vector image',
          icon: 'ph-light ph-selection icon-export-as-svg',
          response: 'svg',
        },
        {
          type: 'response_link',
          label: 'DMN',
          sublabel: 'Export as copy',
          icon: 'ph-duotone ph-copy icon-export-as-dmn',
          response: 'dmn',
        },
      ],
      actions: [],
    };

    const dialogResult = await bifrost.dialog.open(dialogOptions);
    if (dialogResult.wasCancelled) {
      return;
    }
    assertNotNull(dialogResult.response, 'dialog.response');

    const format = dialogResult.response;
    const getDefaultPath = (uri: string, imageFileExtension: string): string => {
      const isLocalFilename = bifrost.files.isLocalFilename(uri);
      if (isLocalFilename) {
        const dmnFilename = bifrost.files.getLocalFilenameForUri(uri);
        const dmnFileExtension = bifrost.files.getFileExtension(uri);
        const regex = new RegExp(`${dmnFileExtension}$`, 'gi');
        const defaultPath =
          dmnFileExtension === ''
            ? `${dmnFilename}${imageFileExtension}`
            : dmnFilename.replace(regex, imageFileExtension);

        return defaultPath;
      }

      return `${editorDocument.label}${imageFileExtension}`;
    };

    const extensionMap: Record<string, { name: string; extensions: string[] }> = {
      svg: { name: 'SVG', extensions: ['svg'] },
      dmn: { name: 'DMN', extensions: ['dmn'] },
    };
    const extension = extensionMap[format];

    const targetFilename = await bifrost.dialog.showSaveFile({
      defaultPath: getDefaultPath(editorDocument.uri, `.${format}`),
      filters: [extension],
    });
    if (targetFilename == null || targetFilename.trim() === '') {
      return;
    }

    bifrost.commands.executeCommand('std.editor.exportDocumentAs', [editorDocument, format, targetFilename]);
  });

  bifrost.commands.register(
    'std.editor.exportDocumentAs.dmn',
    async (editorDocument: EditorDocument, format: string, filename: string) => {
      const model = await bifrost.editors.getEditorDocumentModel<DmnDocumentModel>(editorDocument);

      const extensionHandlerMap: Record<string, () => Promise<string>> = {
        svg: () => model.modelerAdapter.getSvg(),
        dmn: async () => model.currentXml,
      };

      const extensionHandler = extensionHandlerMap[format];
      const fileContent = await extensionHandler();
      const targetUri = bifrost.files.getUriForFilename(filename);

      bifrost.files.save(targetUri, fileContent);
    },
  );

  bifrost.commands.register('std.editor.zoomToActualSize.dmn', async (editorDocument: EditorDocument) => {
    const model = await bifrost.editors.getEditorDocumentModel<DmnDocumentModel>(editorDocument);

    if (model.isReadyForInteraction()) {
      model.setZoom(1);
    }
  });

  bifrost.commands.register('std.editor.zoomToViewport.dmn', async (editorDocument: EditorDocument) => {
    const model = await bifrost.editors.getEditorDocumentModel<DmnDocumentModel>(editorDocument);

    if (model.isReadyForInteraction()) {
      model.zoomToViewport();
    }
  });

  bifrost.commands.register('std.editor.zoomToSelectedElement.dmn', async (editorDocument: EditorDocument) => {
    const model = await bifrost.editors.getEditorDocumentModel<DmnDocumentModel>(editorDocument);

    if (model.isReadyForInteraction()) {
      const activeView = model.modelerAdapter.getActiveView();
      if (activeView?.element?.id != null) {
        model.zoomToElement(activeView.element.id);
      }
    }
  });

  bifrost.commands.register(
    'std.editor.gotoSymbolInDocument.dmn',
    async (editorDocument: EditorDocument, symbolId: string) => {
      const model = await bifrost.editors.getEditorDocumentModel<DmnDocumentModel>(editorDocument);

      model.onceInteractive(() => {
        if (model.modelerAdapter.isElementOnDrd(symbolId)) {
          model.zoomToElement(symbolId);
          model.selection.selectElement(symbolId);
        } else {
          model.zoomToViewport();
        }
      });
    },
  );

  bifrost.commands.register('std.editor.addFileExtensionIfMissing.dmn', (filename: string) => {
    const isMissingExtension = filename.match(/\.dmn$/) == null;
    return isMissingExtension ? `${filename}.dmn` : filename;
  });

  function getMergeResolverApi(model: any): any | null {
    return model?.resolverRef?.current ?? null;
  }

  bifrost.commands.register('git.merge.getResultXml.dmn', async (model: any): Promise<string | null> => {
    const result = getMergeResolverApi(model)?.getResultXml();
    return (result instanceof Promise ? await result : result) ?? null;
  });

  bifrost.commands.register('git.merge.isFullyResolved.dmn', (model: any): boolean => {
    return getMergeResolverApi(model)?.isFullyResolved() ?? false;
  });

  bifrost.commands.register('git.merge.getResolutionProgress.dmn', (model: any) => {
    return getMergeResolverApi(model)?.getResolutionProgress() ?? null;
  });

  bifrost.commands.register('git.merge.zoomToViewport.dmn', (model: any) => {
    getMergeResolverApi(model)?.zoomToViewport();
  });

  bifrost.commands.register('git.merge.zoomToActualSize.dmn', (model: any) => {
    getMergeResolverApi(model)?.zoomToActualSize();
  });

  bifrost.commands.register('git.merge.zoomToSelectedElement.dmn', (model: any) => {
    getMergeResolverApi(model)?.zoomToSelectedElement();
  });

  bifrost.commands.register('git.merge.selectNextConflict.dmn', (model: any) => {
    getMergeResolverApi(model)?.selectNextConflict();
  });

  bifrost.commands.register('git.merge.selectPreviousConflict.dmn', (model: any) => {
    getMergeResolverApi(model)?.selectPreviousConflict();
  });

  bifrost.commands.register(
    'git.merge.getCurrentConflictIndex.dmn',
    (model: any): { current: number | null; total: number } | null => {
      return getMergeResolverApi(model)?.getCurrentConflictIndex() ?? null;
    },
  );

  bifrost.commands.register('git.merge.acceptOursForElement.dmn', (model: any, elementId: string) => {
    getMergeResolverApi(model)?.acceptOursForElement(elementId);
  });

  bifrost.commands.register('git.merge.acceptTheirsForElement.dmn', (model: any, elementId: string) => {
    getMergeResolverApi(model)?.acceptTheirsForElement(elementId);
  });

  bifrost.commands.register('git.merge.acceptAllOurs.dmn', (model: any) => {
    getMergeResolverApi(model)?.acceptAllOurs();
  });

  bifrost.commands.register('git.merge.acceptAllTheirs.dmn', (model: any) => {
    getMergeResolverApi(model)?.acceptAllTheirs();
  });

  const getFocusedDmnDocumentModel = (): DmnDocumentModel | null => {
    const editorDocument = bifrost.editors.getFocusedEditorDocument();
    if (editorDocument?.documentType !== 'dmn') {
      return null;
    }
    return bifrost.editors.getEditorDocumentModelIfPresent<DmnDocumentModel>(editorDocument);
  };

  const isDmnDrdFocusedAndReady = (): boolean => {
    const model = getFocusedDmnDocumentModel();
    return model != null && model.isReadyForInteraction() && model.getActiveViewType() === 'drd';
  };

  const hasExactlyOneDmnElementSelected = (): boolean => {
    const model = getFocusedDmnDocumentModel();
    return model != null && model.getActiveViewType() === 'drd' && model.selection.getOnlyElementOrNull() != null;
  };

  bifrost.commands.register(
    'dmn.editor.deleteSelectedElements',
    () => {
      const model = getFocusedDmnDocumentModel();
      if (model != null) {
        model.modelerAdapter.deleteSelectedElements();
      }
    },
    { enabledWhen: () => bifrost.editors.getFocusedEditorDocument()?.metadata?.hasSelection === true },
  );

  bifrost.commands.register(
    'dmn.editor.openSettings',
    () => {
      bifrost.commands.executeCommand('std.settings.openUserSettingsAtCategory', ['DMN Editor']);
    },
    {
      visibleInSearch: true,
      description: ['DMN: Open DMN Settings', 'DMN: Settings'],
    },
  );

  bifrost.commands.register(
    'dmn.editor.toggleShowGrid',
    () => {
      void bifrost.settings.set('dmn.editor.showGrid', !bifrost.settings.get('dmn.editor.showGrid'));
    },
    {
      visibleInSearch: true,
      description: ['DMN: Toggle Grid', 'DMN: Show Grid', 'DMN: Hide Grid'],
    },
  );

  bifrost.commands.register(
    'dmn.editor.toggleShowMinimap',
    () => {
      void bifrost.settings.set('dmn.editor.showMinimap', !bifrost.settings.get('dmn.editor.showMinimap'));
    },
    {
      visibleInSearch: true,
      description: ['DMN: Toggle Minimap', 'DMN: Show Minimap', 'DMN: Hide Minimap'],
    },
  );

  bifrost.commands.register(
    'dmn.editor.selectAllElements',
    () => {
      const model = getFocusedDmnDocumentModel();
      if (model != null) {
        model.modelerAdapter.selectAllElements();
      }
    },
    {
      visibleInSearch: true,
      description: ['DMN: Select All', 'DMN: Select all elements'],
      enabledWhen: isDmnDrdFocusedAndReady,
    },
  );

  bifrost.commands.register(
    'dmn.editor.zoomToSelectedElement',
    () => {
      const model = getFocusedDmnDocumentModel();
      if (model == null || !model.isReadyForInteraction()) {
        return;
      }
      const selectedElementId = model.selection.getOnlyElementOrNull()?.id;
      if (selectedElementId != null) {
        model.zoomToElement(selectedElementId);
      }
    },
    {
      visibleInSearch: true,
      description: ['DMN: Zoom to Element', 'DMN: Zoom to selected element'],
      enabledWhen: hasExactlyOneDmnElementSelected,
    },
  );

  bifrost.commands.register(
    'dmn.editor.openElementInTextEditor',
    async () => {
      const editorDocument = bifrost.editors.getFocusedEditorDocument();
      if (editorDocument?.documentType !== 'dmn') {
        return;
      }
      const model = bifrost.editors.getEditorDocumentModelIfPresent<DmnDocumentModel>(editorDocument);
      const selectedElementId = model?.selection.getOnlyElementOrNull()?.id;
      if (selectedElementId == null) {
        return;
      }

      const uri = editorDocument.uri;
      const xml = await bifrost.files.load(uri);
      const regex = new RegExp(`\\sid="${selectedElementId}"`, 'gim');
      const index = xml.search(regex);
      if (index === -1) {
        return;
      }

      const positionIndex = index + 5;
      const xmlBeforeIndex = xml.substring(0, positionIndex).split('\n');
      const line = xmlBeforeIndex.length;
      const column = xmlBeforeIndex[line - 1].length + 1;

      bifrost.commands.executeCommand('std.shell.openDocumentInTextEditor', [uri, line, column]);
    },
    {
      visibleInSearch: true,
      description: ['DMN: Open in Text Editor', 'DMN: Open element in text editor'],
      enabledWhen: () => {
        if (!hasExactlyOneDmnElementSelected()) {
          return false;
        }
        const editorDocument = bifrost.editors.getFocusedEditorDocument();
        if (editorDocument == null) {
          return false;
        }
        return bifrost.commands.isCommandEnabled('std.shell.openDocumentInTextEditor', [editorDocument.uri]);
      },
    },
  );

  bifrost.commands.register(
    'dmn.diff.compareTwoFilesFromSolution',
    async () => {
      const solution = bifrost.solution.getSolution();
      if (!solution) {
        return;
      }

      const solutionBaseUrl = solution.projects[0].baseUri;
      const dmnsInSolution = await getSolutionContentAsFileUriList(solutionBaseUrl);

      await bifrost.commands.executeCommand('dmn.diff.compareTwoFilesFromSolution.selectFileA', [
        solutionBaseUrl,
        dmnsInSolution,
      ]);
    },
    {
      visibleInSearch: true,
      description: ['DMN: Compare two DMN files', 'DMN: Diff two files'],
      enabledWhen: () => bifrost.solution.getSolution() != null,
    },
  );

  bifrost.commands.register(
    'dmn.diff.compareTwoFilesFromSolution.selectFileA',
    async (solutionBaseUrl: string, dmnsInSolution: string[]) => {
      bifrost.quickJump.show({
        prompt: 'Select first file ...',
        entries: dmnsInSolution.map((dmnFileUri) => {
          return {
            type: 'command',
            label: bifrost.files.getFilename(dmnFileUri),
            sublabel: getSublabelForUri(dmnFileUri, solutionBaseUrl),
            icon: 'dmn/editor-tab/dmn',
            command: 'dmn.diff.compareTwoFilesFromSolution.selectFileB',
            commandArgs: [solutionBaseUrl, dmnsInSolution, dmnFileUri],
          };
        }),
      });
    },
  );

  bifrost.commands.register(
    'dmn.diff.compareTwoFilesFromSolution.selectFileB',
    async (solutionBaseUrl: string, dmnsInSolution: string[], fileAUri: string) => {
      bifrost.quickJump.show({
        prompt: `Select file to compare against ${bifrost.files.getFilename(fileAUri)}...`,
        entries: dmnsInSolution.map((dmnFileUri) => {
          return {
            type: 'command',
            label: bifrost.files.getFilename(dmnFileUri),
            sublabel: getSublabelForUri(dmnFileUri, solutionBaseUrl),
            icon: 'dmn/editor-tab/dmn',
            command: 'dmn.diff.openDiffTwoFiles',
            commandArgs: [fileAUri, dmnFileUri],
          };
        }),
      });
    },
  );

  function getSublabelForUri(dmnFilePath: string, solutionBasePath: string): string {
    const relativePath = path.relative(solutionBasePath, dmnFilePath);
    return relativePath.split(path.sep).join(' / ');
  }

  async function getSolutionContentAsFileUriList(solutionBaseUrl: string): Promise<string[]> {
    const solutionContent = await bifrost.files.traverseDirectory(solutionBaseUrl, async (entry) => {
      if (entry.type === 'directory' || entry.uri.endsWith('.dmn')) {
        return entry;
      }

      return null;
    });

    function flattenTree(entry: FileOrDirectory): string[] {
      if (entry.type === 'file') {
        return [entry.uri];
      }

      return entry.entries.flatMap(flattenTree);
    }

    return solutionContent.flatMap(flattenTree);
  }
}
