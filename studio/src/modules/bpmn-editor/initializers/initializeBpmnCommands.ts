import type { Bifrost } from '#bifrost/Bifrost';
import type { FileOrDirectory } from '#bifrost/contracts/FileSystemTypes';
import { renderBpmnToPng, renderBpmnToSvg } from '#modules/bpmn-core/BpmnExportFunctions';
import type { ProjectProcess } from '#modules/bpmn-core/BpmnSpecificSolutionAndProjectTypes';
import { DataObjectDetailLevel } from '#modules/bpmn-core/DataObjectDetailsSettings';
import evilPlatformModdleDescriptor from '#modules/bpmn-core/bpmn-js/moddle/evil-platform.json';
import { suggestNextVersion } from '#modules/engine-core';
import { BpmnModdle } from 'bpmn-moddle';
import * as path from 'path';

import type { DialogOptions, DialogValidationCallbackFn, EditorDocument } from '@evil/bifrost_fw_sdk';
import { BpmnElementType, assertNotNull, getUrlForOpenInNewTab } from '@evil/bifrost_fw_sdk';
import type {
  BpmnElementColor,
  BpmnElement_Participant,
  BpmnElement_Process,
  CustomServiceTaskType,
} from '@evil/bifrost_fw_sdk/types/bpmn/BpmnElementTypes';

import { BPMN_DOCUMENT_TYPE } from '..';
import type BpmnDocumentModel from '../BpmnDocumentModel';
import NEW_EMPTY_DOCUMENT from '../BpmnEmptyDocument.bpmn';
import { getInternalCustomPropertyNames } from '../panes/BpmnElementCustomPropertiesFunctions';

const QNAME_REGEX = /^([a-z][\w-.]*:)?[a-z_][\w-.]*$/i;
const INVALID_FIRST_CHARACTER_REGEX = /^[\d-.:]/i;

const serviceTaskCustomTypes: CustomServiceTaskType[] = [];
const knownCustomPropertiesFromExtensions: { [type: string]: string[] } = {};

export function initializeBpmnCommands(bifrost: Bifrost): void {
  bifrost.commands.register(
    'bpmn.workbench.openOrFocusInspector',
    () => {
      bifrost.panes.setVisibilityOfPaneAreaByPaneId('inspectors/editor_document_inspector', true);
    },
    {
      visibleInSearch: true,
      description: ['Editor: Open Inspector', 'Editor: Show Inspector', 'Editor: Toggle Inspector'],
    },
  );

  bifrost.commands.register(
    'bpmn.editor.showDocumentationMarker',
    () =>
      bifrost.settings.set(
        'bpmn.editor.showDocumentationMarker',
        !bifrost.settings.get('bpmn.editor.showDocumentationMarker'),
      ),
    {
      visibleInSearch: true,
      description: ['Editor: Toggle Show Documentation Marker', 'Editor: Toggle display of Documentation Marker'],
    },
  );

  bifrost.commands.register(
    'bpmn.editor.toggleShowGrid',
    () => bifrost.settings.set('bpmn.editor.showGrid', !bifrost.settings.get('bpmn.editor.showGrid')),
    {
      visibleInSearch: true,
      description: ['Editor: Toggle Show BPMN Grid'],
    },
  );

  bifrost.commands.register(
    'bpmn.editor.drillDown',
    async () => {
      const editorDocument = bifrost.editors.getFocusedEditorDocument();
      if (editorDocument == null || editorDocument.documentType !== BPMN_DOCUMENT_TYPE) {
        return;
      }
      const bpmnDocumentModel = await bifrost.editors.getEditorDocumentModel<BpmnDocumentModel>(editorDocument);
      const selected = bpmnDocumentModel.selection.getOnlyElementOrNull();
      if (selected == null || selected.type !== BpmnElementType.Subprocess) {
        return;
      }
      const canvas = bpmnDocumentModel.modelerAdapter.getCanvas();
      const planeId = `${selected.id}_plane`;
      const targetRoot = canvas.findRoot(planeId);
      if (targetRoot != null) {
        canvas.setRootElement(targetRoot);
      }
    },
    {
      visibleInSearch: true,
      description: ['Editor: Drill into subprocess', 'Editor: Enter subprocess'],
    },
  );

  bifrost.commands.register(
    'bpmn.editor.drillUp',
    async () => {
      const editorDocument = bifrost.editors.getFocusedEditorDocument();
      if (editorDocument == null || editorDocument.documentType !== BPMN_DOCUMENT_TYPE) {
        return;
      }
      const bpmnDocumentModel = await bifrost.editors.getEditorDocumentModel<BpmnDocumentModel>(editorDocument);
      if (!bpmnDocumentModel.elements.isInsideSubprocessPlane()) {
        return;
      }
      const canvas = bpmnDocumentModel.modelerAdapter.getCanvas();
      const rootElement = canvas.getRootElement();
      const subprocessId = rootElement?.businessObject?.id;
      if (subprocessId == null) {
        return;
      }
      const elementRegistry = bpmnDocumentModel.modelerAdapter.getElementRegistry();
      const subprocessShape = elementRegistry.get(subprocessId);
      if (subprocessShape?.parent != null) {
        canvas.setRootElement(subprocessShape.parent);
      }
    },
    {
      visibleInSearch: true,
      description: ['Editor: Return to parent plane', 'Editor: Exit subprocess'],
    },
  );

  bifrost.commands.register(
    'bpmn.editor.toggleShowInternalCustomProperties',
    () =>
      bifrost.settings.set(
        'bpmn.editor.showInternalCustomProperties',
        !bifrost.settings.get('bpmn.editor.showInternalCustomProperties'),
      ),
    {
      visibleInSearch: true,
      description: ['Editor: Toggle Show internal custom properties'],
    },
  );

  bifrost.commands.register(
    'bpmn.editor.showMultipleOutgoingSequenceFlowsMarkers',
    () =>
      bifrost.settings.set(
        'bpmn.editor.showMultipleOutgoingSequenceFlowsMarkers',
        !bifrost.settings.get('bpmn.editor.showMultipleOutgoingSequenceFlowsMarkers'),
      ),
    {
      visibleInSearch: true,
      description: [
        'Editor: Toggle Show Multiple Outgoing Sequence Flows Markers',
        'Editor: Toggle display of mulitple outgoing Sequence Flows Markers',
      ],
    },
  );

  bifrost.commands.register(
    'bpmn.editor.startSettingDataObjectDetailLevel',
    () => bifrost.commands.executeCommand('bpmn.editor.showDataObjectDetailLevels'),
    {
      visibleInSearch: true,
      description: ['Editor: Set Data Object Detail Level'],
    },
  );

  bifrost.commands.register('bpmn.editor.showDataObjectDetailLevels', () => {
    bifrost.quickJump.show({
      prompt: 'Editor: Set Data Object Detail Level ...',
      entries: [
        {
          type: 'command',
          label: 'Show everything',
          command: 'bpmn.editor.setDataObjectDetailLevel',
          commandArgs: [DataObjectDetailLevel.showAll],
        },
        {
          type: 'command',
          label: 'Hide input associations',
          command: 'bpmn.editor.setDataObjectDetailLevel',
          commandArgs: [DataObjectDetailLevel.hideInputAssociations],
        },
        {
          type: 'command',
          label: 'Hide all associations',
          command: 'bpmn.editor.setDataObjectDetailLevel',
          commandArgs: [DataObjectDetailLevel.hideAllAssociations],
        },
        {
          type: 'command',
          label: 'Hide everything',
          command: 'bpmn.editor.setDataObjectDetailLevel',
          commandArgs: [DataObjectDetailLevel.hideAll],
        },
      ],
    });
  });

  bifrost.commands.register('bpmn.editor.setDataObjectDetailLevel', (newLevel) => {
    bifrost.settings.set('bpmn.editor.dataObjectDetailLevel', newLevel);
  });

  bifrost.commands.register(
    'bpmn.editor.openSettings',
    () => {
      bifrost.commands.executeCommand('std.settings.openUserSettingsAtCategory', ['BPMN Editor']);
    },
    {
      visibleInSearch: true,
      description: ['Editor: Open BPMN Settings', 'Editor: Show BPMN Settings'],
    },
  );

  bifrost.commands.register(
    'bpmn.editor.newBpmnDocument',
    () => bifrost.editors.createNewEditorDocumentAsBuffer(BPMN_DOCUMENT_TYPE, ''),
    {
      visibleInSearch: true,
      description: ['Editor: New BPMN document', 'New BPMN file'],
    },
  );

  bifrost.commands.register('bpmn.serviceTasks.registerCustomType', (taskType: { type: string; label: string }) => {
    serviceTaskCustomTypes.push({
      implementation: taskType.type,
      label: taskType.label,
    });
  });

  bifrost.commands.register('bpmn.serviceTasks.removeCustomType', (id: string) => {
    const indexOfTaskType = serviceTaskCustomTypes.findIndex((customType) => customType.implementation === id);

    if (indexOfTaskType == -1) {
      return;
    }

    serviceTaskCustomTypes.splice(indexOfTaskType, 1);
  });

  bifrost.commands.register('bpmn.serviceTasks.getCustomTypes', () => serviceTaskCustomTypes);

  bifrost.commands.register(
    'bpmn.customProperties.registerInternalProperty',
    (elementType: BpmnElementType, propertyName: string) => {
      if (knownCustomPropertiesFromExtensions[elementType] == null) {
        knownCustomPropertiesFromExtensions[elementType] = [propertyName];
      } else {
        knownCustomPropertiesFromExtensions[elementType].push(propertyName);
      }
    },
  );

  bifrost.commands.register('bpmn.customProperties.getInternalPropertiesByBpmnElementType', (type: BpmnElementType) => {
    const defaultInternalProperties = getInternalCustomPropertyNames(type);
    const internalPropertiesFromExtension = knownCustomPropertiesFromExtensions[type] ?? [];

    return [...defaultInternalProperties, ...internalPropertiesFromExtension];
  });

  bifrost.commands.register('bpmn.callActivity.openTargetProcess', async (processModelId: string) => {
    const matchingSymbols = await bifrost.symbolIndex.getAll({ id: processModelId });

    if (matchingSymbols.length === 0) {
      bifrost.notifications.open({
        type: 'error',
        content: `Call Activity target process "${processModelId}" was not found in the opened solution.`,
      });

      return;
    }

    bifrost.commands.executeCommand('std.editor.gotoSymbolInDocument', [matchingSymbols[0].uri, matchingSymbols[0].id]);
  });

  bifrost.commands.register('bpmn.businessRuleTask.openTargetDecision', async (decisionRef: string) => {
    const matchingSymbols = await bifrost.symbolIndex.getAll({ type: 'dmn:Definitions', id: decisionRef });

    if (matchingSymbols.length === 0) {
      bifrost.notifications.open({
        type: 'error',
        content: `Business Rule Task target DMN "${decisionRef}" was not found in the opened solution.`,
      });

      return;
    }

    bifrost.commands.executeCommand('std.editor.gotoSymbolInDocument', [matchingSymbols[0].uri, matchingSymbols[0].id]);
  });

  bifrost.commands.register('bpmn.formBuilder.open', (bpmnDocumentModel: BpmnDocumentModel, elementId: string) => {
    assertNotNull(bpmnDocumentModel, 'bpmnDocumentModel');

    const parentUri = bpmnDocumentModel.getUri();
    const uri = getUrlForOpenInNewTab('bpmn.form-builder', parentUri, elementId);
    const element = bpmnDocumentModel.elements.getById(elementId);
    const title = element?.name ? `Form: ${element.name}` : `Form: ${elementId}`;
    bifrost.editors.focusOrOpenEditorDocument(uri, title);
  });

  bifrost.commands.register('bpmn.diagram.getNewUniqueXml', async (filename?: string) => {
    let sanitizedFileName = filename;

    const lastOccurenceOfFileSuffix = filename?.lastIndexOf('.bpmn') ?? -1;
    if (lastOccurenceOfFileSuffix != -1) {
      sanitizedFileName = filename?.substring(0, lastOccurenceOfFileSuffix);
    }
    return bifrost.commands.executeCommand('bpmn.diagram.resetRelevantIds', [NEW_EMPTY_DOCUMENT, sanitizedFileName]);
  });

  bifrost.commands.register('bpmn.diagram.resetRelevantIds', async (xml: string, filename?: string) => {
    let qNameId;

    if (filename != null) {
      const isValid = QNAME_REGEX.test(filename);

      if (isValid) {
        qNameId = filename;
      } else {
        let qNameValidFilename = replaceMutatedVowels(filename);

        const invalidCharacters = getInvalidCharactersForBpmnId(filename);
        for (const invalidCharacter of invalidCharacters) {
          qNameValidFilename = qNameValidFilename.replace(invalidCharacter, '_');
        }

        if (INVALID_FIRST_CHARACTER_REGEX.test(qNameValidFilename)) {
          qNameValidFilename = `_${qNameValidFilename}`;
        }

        qNameId = qNameValidFilename;
      }
    }

    const definitionId = qNameId ? `${qNameId}_Definition` : `${bifrost.getGuid()}_Definition`;
    const processId = qNameId ? `${qNameId}_Process` : `${bifrost.getGuid()}_Process`;
    const processName = qNameId ? `${filename}` : 'Untitled Process';

    const moddle = new BpmnModdle({ evil: evilPlatformModdleDescriptor });
    const { rootElement: definitions } = await moddle.fromXML(xml);
    definitions.set('id', definitionId);

    // TODO: support more than 1 process per file here
    const process = definitions.rootElements.find((element) => {
      return element.$type === 'bpmn:Process';
    });
    process.set('id', processId);
    process.set('name', processName);

    const participant = definitions.rootElements.find((element) => element.$type === 'bpmn:Collaboration')
      ?.participants[0];
    participant.set('name', processName);

    const { xml: xmlStrUpdated } = await moddle.toXML(definitions);

    return xmlStrUpdated;
  });

  bifrost.commands.register(
    'std.solution.newFile.bpmn',
    async (filename: string) => {
      const bpmnFileTemplate = await bifrost.commands.executeCommand<Promise<string>>('bpmn.diagram.getNewUniqueXml', [
        filename,
      ]);

      return bpmnFileTemplate;
    },
    { enabledWhen: () => bifrost.solution.hasOpenSolution() },
  );

  bifrost.commands.register(
    'std.solution.compareTo.bpmn',
    async (fileA: string) => {
      const initialFolder = await bifrost.files.getLocalDirectory(fileA);

      const fileB = await bifrost.dialog.showOpenFile({
        defaultPath: initialFolder,
        properties: ['openFile'],
        message: 'Select BPMN for comparison',
        filters: [{ name: 'BPMN', extensions: ['bpmn'] }],
      });

      if (!fileB || fileB.length === 0) {
        return;
      }

      const fileBAsString = Array.isArray(fileB) ? fileB[0] : fileB;

      const fileBAsUri = bifrost.files.getUriForFilename(fileBAsString);

      bifrost.commands.executeCommand('bpmn.diff.openDiffTwoFiles', [fileA, fileBAsUri]);
    },
    {
      enabledWhen: (fileA: string) => {
        if (!fileA) {
          return false;
        }

        const isLocalFile = bifrost.files.isLocalFilename(fileA);
        const extension = bifrost.files.getFileExtension(fileA);

        return isLocalFile && extension === '.bpmn';
      },
    },
  );

  bifrost.commands.register(
    'bpmn.diff.compareTwoFilesFromSolution',
    async () => {
      const solution = bifrost.solution.getSolution();
      if (!solution) {
        return;
      }

      const solutionBaseUrl = solution.projects[0].baseUri;

      const bpmnsInSolution = await getSolutionContentAsFileUriList(solutionBaseUrl);

      await bifrost.commands.executeCommand('bpmn.diff.compareTwoFilesFromSolution.selectFileA', [
        solutionBaseUrl,
        bpmnsInSolution,
      ]);
    },
    {
      visibleInSearch: true,
      description: [
        'Diff: Compare two BPMNs from the current solution',
        'Editor: Compare two BPMNs from the current solution',
      ],
      enabledWhen: () => bifrost.solution.getSolution() != null,
    },
  );

  bifrost.commands.register(
    'bpmn.diff.compareTwoFilesFromSolution.selectFileA',
    async (solutionBaseUrl: string, bpmnsInSolution: string[]) => {
      bifrost.quickJump.show({
        prompt: `Select first file ...`,
        entries: bpmnsInSolution.map((bpmnFileUri) => {
          return {
            type: 'command',
            label: bifrost.files.getFilename(bpmnFileUri),
            sublabel: getSublabelForUri(bpmnFileUri, solutionBaseUrl),
            icon: 'bpmn/editor-tab/bpmn',
            command: 'bpmn.diff.compareTwoFilesFromSolution.selectFileB',
            commandArgs: [solutionBaseUrl, bpmnsInSolution, bpmnFileUri],
          };
        }),
      });
    },
  );

  bifrost.commands.register(
    'bpmn.diff.compareTwoFilesFromSolution.selectFileB',
    async (solutionBaseUrl: string, bpmnsInSolution: string[], fileAUri: string) => {
      bifrost.quickJump.show({
        prompt: `Select file to compare against ${bifrost.files.getFilename(fileAUri)}...`,
        entries: bpmnsInSolution.map((bpmnFileUri) => {
          return {
            type: 'command',
            label: bifrost.files.getFilename(bpmnFileUri),
            sublabel: getSublabelForUri(bpmnFileUri, solutionBaseUrl),
            icon: 'bpmn/editor-tab/bpmn',
            command: 'bpmn.diff.openDiffTwoFiles',
            commandArgs: [fileAUri, bpmnFileUri],
          };
        }),
      });
    },
  );

  function getSublabelForUri(bpmnFilePath: string, solutionBasePath: string): string {
    const relativePath = path.relative(solutionBasePath, bpmnFilePath);
    return relativePath.split(path.sep).join(' / ');
  }

  async function getSolutionContentAsFileUriList(solutionBaseUrl: string): Promise<string[]> {
    const solutionContent = await bifrost.files.traverseDirectory(solutionBaseUrl, async (entry) => {
      if (entry.type === 'directory' || entry.uri.endsWith('.bpmn')) {
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

  bifrost.commands.register('bpmn.workbench.focusSelectionInspector', () => {
    bifrost.panes.togglePaneAreaByPaneId('inspectors/editor_document_inspector');
  });

  bifrost.commands.register('std.editor.showExportDialog.bpmn', async () => {
    const editorDocument = bifrost.editors.getFocusedEditorDocument();
    assertNotNull(editorDocument, 'editorDocument');

    const dialogOptions: DialogOptions = {
      title: 'Export BPMN as ...',
      content: [
        {
          type: 'response_link',
          label: 'SVG',
          sublabel: 'Higher quality',
          icon: 'ph-light ph-selection icon-export-as-svg',
          response: 'svg',
        },
        {
          type: 'response_link',
          label: 'PNG',
          sublabel: 'Easier to share',
          icon: 'ph-duotone ph-palette icon-export-as-png',
          response: 'png',
        },
        {
          type: 'response_link',
          label: 'BPMN',
          sublabel: 'Export as copy',
          icon: 'ph-duotone ph-copy icon-export-as-bpmn',
          response: 'bpmn',
        },
      ],
      actions: [],
    };

    const dialogResult = await bifrost.dialog.open(dialogOptions);
    if (dialogResult.wasCancelled) {
      return;
    }
    assertNotNull(dialogResult.response, 'dialog.response');

    const getDefaultPath = (uri: string, imageFileExtension: string): string => {
      const isLocalFilename = bifrost.files.isLocalFilename(uri);
      if (isLocalFilename) {
        const bpmnFilename = isLocalFilename ? bifrost.files.getLocalFilenameForUri(uri) : '';
        const bpmnFileExtension = isLocalFilename ? bifrost.files.getFileExtension(uri) : '';
        const regex = new RegExp(`${bpmnFileExtension}$`, 'gi');
        const defaultPath =
          bpmnFileExtension === ''
            ? `${bpmnFilename}${imageFileExtension}`
            : bpmnFilename.replace(regex, imageFileExtension);

        return defaultPath;
      }

      return `${editorDocument.label}${imageFileExtension}`;
    };

    const extensionMap = {
      svg: { name: 'SVG', extensions: ['svg'] },
      png: { name: 'PNG', extensions: ['png'] },
      bpmn: { name: 'BPMN', extensions: ['bpmn'] },
    };
    const format = dialogResult.response;
    const extension = extensionMap[format];

    const targetFilename = await bifrost.dialog.showSaveFile({
      defaultPath: getDefaultPath(editorDocument.uri, `.${format}`),
      filters: [extension],
    });
    if (targetFilename == null || targetFilename.trim() === '') {
      return;
    }

    bifrost.commands.executeCommand('std.editor.exportDocumentAs', [editorDocument, format, targetFilename]);

    const localStorage = bifrost.getLocalStorage('document-exports');

    const documentExportHistory = localStorage.load() ?? {};

    documentExportHistory[editorDocument.uri] = {
      targetFileUri: bifrost.files.getUriForFilename(targetFilename),
      format: format,
    };

    localStorage.save(documentExportHistory);
  });

  bifrost.commands.register(
    'std.editor.reexportFile.bpmn',
    async () => {
      const editorDocument = bifrost.editors.getFocusedEditorDocument();
      assertNotNull(editorDocument, 'editorDocument');

      const localStorage = bifrost.getLocalStorage('document-exports');

      const storedDocumentExportSettings = localStorage.load() ?? {};
      const settingsForDocument = storedDocumentExportSettings[editorDocument.uri];

      const localFileName = bifrost.files.getLocalFilenameForUri(settingsForDocument.targetFileUri);

      bifrost.commands.executeCommand('std.editor.exportDocumentAs', [
        editorDocument,
        settingsForDocument.format,
        localFileName,
      ]);
    },
    {
      enabledWhen: () => {
        const editorDocument = bifrost.editors.getFocusedEditorDocument();

        const localStorage = bifrost.getLocalStorage('document-exports');

        const storedDocumentExportSettings = localStorage.load() ?? {};

        return editorDocument != null && storedDocumentExportSettings[editorDocument.uri] != null;
      },
    },
  );

  if (process.env.APP_TEST == 'true') {
    bifrost.commands.register(
      'test.editor.exportDocumentAs',
      async () => {
        const editorDocument = bifrost.editors.getFocusedEditorDocument();
        assertNotNull(editorDocument, 'editorDocument');

        const format = await bifrost.dialog.prompt('Enter a format', 'e.g. png');
        if (format == null || format.trim() === '') {
          return;
        }

        const filename = await bifrost.dialog.prompt('Save as URI', 'Enter a URI, e.g. file://documents/sample.png');
        if (filename == null || filename.trim() === '') {
          return;
        }

        bifrost.commands.executeCommand('std.editor.exportDocumentAs', [editorDocument, format, filename]);
      },
      {
        visibleInSearch: true,
        description: 'Test: Export document as ...',
      },
    );
  }

  bifrost.commands.register(
    'std.editor.exportDocumentAs',
    async (editorDocument: EditorDocument, format: string, filename: string) => {
      const extensionHandlerMap = {
        svg: async () => renderBpmnToSvg(editorDocument.data.current),
        png: async () => renderBpmnToPng(editorDocument.data.current),
        bpmn: async () =>
          bifrost.commands.executeCommand('bpmn.diagram.resetRelevantIds', [editorDocument.data.current]),
      };

      const extensionHandler = extensionHandlerMap[format];
      const fileContent = await extensionHandler();
      const targetUri = bifrost.files.getUriForFilename(filename);

      bifrost.files.save(targetUri, fileContent);
    },
  );

  bifrost.commands.register('std.editor.zoomToActualSize.bpmn', async (editorDocument: EditorDocument) => {
    const bpmnDocumentModel = await bifrost.editors.getEditorDocumentModel<BpmnDocumentModel>(editorDocument);

    if (bpmnDocumentModel.isReadyForInteraction()) {
      bpmnDocumentModel.setZoom(1);
    }
  });

  bifrost.commands.register('std.editor.zoomToViewport.bpmn', async (editorDocument: EditorDocument) => {
    const bpmnDocumentModel = await bifrost.editors.getEditorDocumentModel<BpmnDocumentModel>(editorDocument);

    if (bpmnDocumentModel.isReadyForInteraction()) {
      bpmnDocumentModel.zoomToViewport();
    }
  });

  bifrost.commands.register('std.editor.zoomToSelectedElement.bpmn', async (editorDocument: EditorDocument) => {
    const bpmnDocumentModel = await bifrost.editors.getEditorDocumentModel<BpmnDocumentModel>(editorDocument);

    if (bpmnDocumentModel.isReadyForInteraction()) {
      const elements = bpmnDocumentModel.selection.getElements();
      const elementId = elements[0]?.id;

      if (elementId != null) {
        bpmnDocumentModel.zoomToElement(elementId);
      }
    }
  });

  bifrost.commands.register(
    'std.editor.gotoSymbolInDocument.bpmn',
    async (editorDocument: EditorDocument, symbolId: string) => {
      const bpmnDocumentModel = await bifrost.editors.getEditorDocumentModel<BpmnDocumentModel>(editorDocument);

      bpmnDocumentModel.onceInteractive(() => {
        bpmnDocumentModel.zoomToElement(symbolId);
        bpmnDocumentModel.selection.selectElement(symbolId);

        if (bpmnDocumentModel.selection.getOnlyElementOrNull() == null) {
          const symbolIdIsProcessId = bpmnDocumentModel.elements
            .getByType<BpmnElement_Participant>(BpmnElementType.Participant)
            .some((participant) => participant.process?.id === symbolId);

          if (symbolIdIsProcessId) {
            const participantToSelect = bpmnDocumentModel.elements
              .getByType<BpmnElement_Participant>(BpmnElementType.Participant)
              .find((participant) => participant.process?.id === symbolId);

            bifrost.commands.executeCommand('std.editor.gotoSymbolInDocument.bpmn', [
              editorDocument,
              participantToSelect?.id,
            ]);
          }
        }
      });
    },
  );

  bifrost.commands.register('std.editor.addFileExtensionIfMissing.bpmn', (filename: string) => {
    const isMissingExtension = filename.match(/\.(bpmn|xml)$/) == null;

    return isMissingExtension ? `${filename}.bpmn` : filename;
  });

  bifrost.commands.register('std.solution.duplicateFile.bpmn', async (givenUriToRename: string) => {
    const transformBpmnFileContent = (content: string, newUri: string, previousUri: string): Promise<string> => {
      return bifrost.commands.executeCommand('bpmn.diagram.resetRelevantIds', [content]);
    };

    bifrost.commands.executeCommand('std.solution.duplicateFileAndTransformContent', [
      givenUriToRename,
      transformBpmnFileContent,
    ]);
  });

  bifrost.commands.register<ProjectProcess[]>('bpmn.project.getAllReachableProcesses', async (projectId: string) => {
    // this has to be filtered by project document URIs
    const symbols = await bifrost.symbolIndex.getAll({ type: 'bpmn:Process' });

    const processes = symbols
      .map((symbol) => {
        const isLocalFileName = bifrost.files.isLocalFilename(symbol.uri);
        const filename = isLocalFileName ? bifrost.files.getLocalBasename(symbol.uri) : symbol.label;

        return {
          processId: symbol.id,
          filename: filename,
        };
      })
      .filter((x: any, index: number, array: any[]) => array.indexOf(x) === index)
      .sort();

    return processes;
  });

  bifrost.commands.register<string[]>('bpmn.project.getAllStartEventsForProcessId', async (processId: string) => {
    // this has to be filtered by project document URIs
    const symbols = await bifrost.symbolIndex.getAll({
      type: 'bpmn:StartEvent',
      processId: processId,
      metadata: { embeddedProcessModelId: null },
    });

    const filteredSymbols = symbols.filter((result) => {
      return result.processId === processId;
    });

    const startEventsIds = filteredSymbols
      .map((symbol) => {
        return symbol.id;
      })
      .filter((x: any, index: number, array: any[]) => array.indexOf(x) === index)
      .sort();

    return startEventsIds;
  });

  bifrost.commands.register<(string | undefined)[]>('bpmn.project.getAllUniqueMessageNames', async () => {
    // this has to be filtered by project document URIs
    const symbols = await bifrost.symbolIndex.getAll({ type: 'bpmn:Message' });

    return symbols
      .map((symbol) => symbol.name)
      .filter((x, index, array) => x != undefined && array.indexOf(x) === index)
      .sort();
  });

  bifrost.commands.register<(string | undefined)[]>('bpmn.project.getAllUniqueSignalNames', async () => {
    // this has to be filtered by project document URIs
    const symbols = await bifrost.symbolIndex.getAll({ type: 'bpmn:Signal' });

    return symbols
      .map((symbol) => symbol.name)
      .filter((x, index, array) => x != undefined && array.indexOf(x) === index)
      .sort();
  });

  bifrost.commands.register<string[]>('bpmn.project.getAllUniqueErrorCodes', async () => {
    // this has to be filtered by project document URIs
    const symbols = await bifrost.symbolIndex.getAll({ type: 'bpmn:Error' });

    return symbols
      .map((symbol) => {
        return symbol.metadata.errorCode;
      })
      .filter((x: any, index: number, array: any[]) => array.indexOf(x) === index && x != null)
      .sort();
  });

  bifrost.commands.register<string[]>('bpmn.project.getAllUniqueErrorMessages', async () => {
    // this has to be filtered by project document URIs
    const symbols = await bifrost.symbolIndex.getAll({ type: 'bpmn:Error' });

    return symbols
      .map((symbol) => {
        return symbol.metadata.errorMessage;
      })
      .filter((x: any, index: number, array: any[]) => array.indexOf(x) === index && x != null)
      .sort();
  });

  bifrost.commands.register<(string | undefined)[]>(
    'bpmn.project.getAllUniqueLinkNames',
    async (uri: string, linkElementId: string) => {
      // this has to be filtered by project document URIs
      const linkElement = await bifrost.symbolIndex.getAll({ uris: [uri], id: linkElementId });
      if (linkElement.length === 0) {
        return [];
      }
      const symbols = await bifrost.symbolIndex.getAll({
        type: 'bpmn:LinkEventDefinition',
        uris: [uri],
        processId: linkElement[0].processId,
        metadata: { embeddedProcessModelId: linkElement[0].metadata?.embeddedProcessModelId },
      });

      return symbols
        .map((symbol) => {
          return symbol.name;
        })
        .filter((x: any, index: number, array: any[]) => array.indexOf(x) === index && x != null && x !== '')
        .sort();
    },
  );

  bifrost.commands.register<(string | undefined)[]>('bpmn.project.getAllUniqueEscalationNames', async () => {
    // this has to be filtered by project document URIs
    const symbols = await bifrost.symbolIndex.getAll({ type: 'bpmn:Escalation' });

    return symbols
      .map((symbol) => {
        return symbol.name;
      })
      .filter((x: any, index: number, array: any[]) => array.indexOf(x) === index && x != null)
      .sort();
  });

  bifrost.commands.register<(string | undefined)[]>('bpmn.project.getAllUniqueEscalationCodes', async () => {
    // this has to be filtered by project document URIs
    const symbols = await bifrost.symbolIndex.getAll({ type: 'bpmn:Escalation' });

    return symbols
      .map((symbol) => {
        return symbol.metadata?.escalationCode;
      })
      .filter((x: any, index: number, array: any[]) => array.indexOf(x) === index && x != null)
      .sort();
  });

  bifrost.commands.register<(string | undefined)[]>('bpmn.project.getAllUniqueEscalationVariables', async () => {
    // this has to be filtered by project document URIs
    const symbols = await bifrost.symbolIndex.getAll({ type: 'bpmn:EscalationEventDefinition' });

    return symbols
      .map((symbol) => {
        return symbol.metadata?.escalationVariable;
      })
      .filter((x: any, index: number, array: any[]) => array.indexOf(x) === index && x != null && x !== '')
      .sort();
  });
  //

  bifrost.commands.register(
    'bpmn.editor.deleteSelectedElements',
    () => {
      const model = getCurrentlyFocusedBpmnDocumentModel(bifrost);
      if (model != null) {
        model.deleteSelectedElements();
      }
    },
    { enabledWhen: () => bifrost.editors.getFocusedEditorDocument()?.metadata?.hasSelection === true },
  );

  bifrost.commands.register(
    'bpmn.editor.copySelectedElements',
    () => {
      const model = getCurrentlyFocusedBpmnDocumentModel(bifrost);
      if (model != null) {
        const copiedContent = model.copySelectedElements();
        if (copiedContent != null) {
          window.localStorage.setItem('bpmnClipboard', copiedContent);
        }
      }
    },
    { enabledWhen: () => bifrost.editors.getFocusedEditorDocument()?.metadata?.hasSelection === true },
  );

  bifrost.commands.register(
    'bpmn.editor.pasteElements',
    async () => {
      const focusedDocument = bifrost.editors.getFocusedEditorDocument();
      assertNotNull(focusedDocument, 'focusedDocument');
      const model = await bifrost.editors.getEditorDocumentModel<BpmnDocumentModel>(focusedDocument);
      if (model != null) {
        const clipboardContent = window.localStorage.getItem('bpmnClipboard');
        if (clipboardContent != null) {
          model.pasteElements(clipboardContent);
        }
      }
    },
    { enabledWhen: () => bifrost.editors.getFocusedEditorDocument() != null },
  );

  bifrost.commands.register(
    'bpmn.editor.moveSelectedElementsLeft',
    () => bifrost.commands.executeCommand('bpmn.editor.moveSelectedElements', ['left']),
    { enabledWhen: () => bifrost.editors.getFocusedEditorDocument()?.metadata?.hasSelection === true },
  );

  bifrost.commands.register(
    'bpmn.editor.moveSelectedElementsLeftAccelerated',
    () => bifrost.commands.executeCommand('bpmn.editor.moveSelectedElements', ['left', true]),
    { enabledWhen: () => bifrost.editors.getFocusedEditorDocument()?.metadata?.hasSelection === true },
  );

  bifrost.commands.register(
    'bpmn.editor.moveSelectedElementsRight',
    () => bifrost.commands.executeCommand('bpmn.editor.moveSelectedElements', ['right']),
    { enabledWhen: () => bifrost.editors.getFocusedEditorDocument()?.metadata?.hasSelection === true },
  );

  bifrost.commands.register(
    'bpmn.editor.moveSelectedElementsRightAccelerated',
    () => bifrost.commands.executeCommand('bpmn.editor.moveSelectedElements', ['right', true]),
    { enabledWhen: () => bifrost.editors.getFocusedEditorDocument()?.metadata?.hasSelection === true },
  );

  bifrost.commands.register(
    'bpmn.editor.moveSelectedElementsUp',
    () => bifrost.commands.executeCommand('bpmn.editor.moveSelectedElements', ['up']),
    { enabledWhen: () => bifrost.editors.getFocusedEditorDocument()?.metadata?.hasSelection === true },
  );

  bifrost.commands.register(
    'bpmn.editor.moveSelectedElementsUpAccelerated',
    () => bifrost.commands.executeCommand('bpmn.editor.moveSelectedElements', ['up', true]),
    { enabledWhen: () => bifrost.editors.getFocusedEditorDocument()?.metadata?.hasSelection === true },
  );

  bifrost.commands.register(
    'bpmn.editor.moveSelectedElementsDown',
    () => bifrost.commands.executeCommand('bpmn.editor.moveSelectedElements', ['down']),
    { enabledWhen: () => bifrost.editors.getFocusedEditorDocument()?.metadata?.hasSelection === true },
  );

  bifrost.commands.register(
    'bpmn.editor.moveSelectedElementsDownAccelerated',
    () => bifrost.commands.executeCommand('bpmn.editor.moveSelectedElements', ['down', true]),
    { enabledWhen: () => bifrost.editors.getFocusedEditorDocument()?.metadata?.hasSelection === true },
  );

  bifrost.commands.register('bpmn.editor.moveSelectedElements', (direction: string, accelerated: boolean = false) => {
    executeAtMostOnceEvery(16, () => {
      const model = getCurrentlyFocusedBpmnDocumentModel(bifrost);
      assertNotNull(model, 'model');
      model.moveSelectedElements(direction, accelerated);
    });
  });

  bifrost.commands.register('bpmn.editor.hasMoreThanOneSelectedElement', () => {
    const editorDocument = bifrost.editors.getFocusedEditorDocument();
    const hasSelection = editorDocument?.metadata?.hasSelection;
    const moreThanOneSelectedElement = editorDocument?.metadata?.selection?.length > 1;

    return hasSelection && moreThanOneSelectedElement;
  });

  bifrost.commands.register(
    'bpmn.editor.alignSelectedElementsLeft',
    () => bifrost.commands.executeCommand('bpmn.editor.alignSelectedElements', ['left']),
    { enabledWhen: () => bifrost.commands.executeCommand('bpmn.editor.hasMoreThanOneSelectedElement') },
  );

  bifrost.commands.register(
    'bpmn.editor.alignSelectedElementsCenter',
    () => bifrost.commands.executeCommand('bpmn.editor.alignSelectedElements', ['center']),
    { enabledWhen: () => bifrost.commands.executeCommand('bpmn.editor.hasMoreThanOneSelectedElement') },
  );

  bifrost.commands.register(
    'bpmn.editor.alignSelectedElementsRight',
    () => bifrost.commands.executeCommand('bpmn.editor.alignSelectedElements', ['right']),
    { enabledWhen: () => bifrost.commands.executeCommand('bpmn.editor.hasMoreThanOneSelectedElement') },
  );

  bifrost.commands.register(
    'bpmn.editor.alignSelectedElementsTop',
    () => bifrost.commands.executeCommand('bpmn.editor.alignSelectedElements', ['top']),
    { enabledWhen: () => bifrost.commands.executeCommand('bpmn.editor.hasMoreThanOneSelectedElement') },
  );

  bifrost.commands.register(
    'bpmn.editor.alignSelectedElementsMiddle',
    () => bifrost.commands.executeCommand('bpmn.editor.alignSelectedElements', ['middle']),
    { enabledWhen: () => bifrost.commands.executeCommand('bpmn.editor.hasMoreThanOneSelectedElement') },
  );

  bifrost.commands.register(
    'bpmn.editor.alignSelectedElementsBottom',
    () => bifrost.commands.executeCommand('bpmn.editor.alignSelectedElements', ['bottom']),
    { enabledWhen: () => bifrost.commands.executeCommand('bpmn.editor.hasMoreThanOneSelectedElement') },
  );

  bifrost.commands.register('bpmn.editor.alignSelectedElements', (direction: string) => {
    const model = getCurrentlyFocusedBpmnDocumentModel(bifrost);
    assertNotNull(model, 'model');
    model.alignSelectedElements(direction);
  });

  bifrost.commands.register(
    'bpmn.editor.distributeSelectedElementsHorizontally',
    () => bifrost.commands.executeCommand('bpmn.editor.distributeSelectedElements', ['horizontal']),
    { enabledWhen: () => bifrost.commands.executeCommand('bpmn.editor.hasMoreThanOneSelectedElement') },
  );

  bifrost.commands.register(
    'bpmn.editor.distributeSelectedElementsVertically',
    () => bifrost.commands.executeCommand('bpmn.editor.distributeSelectedElements', ['vertical']),
    { enabledWhen: () => bifrost.commands.executeCommand('bpmn.editor.hasMoreThanOneSelectedElement') },
  );

  bifrost.commands.register('bpmn.editor.distributeSelectedElements', (direction: string) => {
    const model = getCurrentlyFocusedBpmnDocumentModel(bifrost);
    assertNotNull(model, 'model');
    model.distributeSelectedElements(direction);
  });

  bifrost.commands.register(
    'bpmn.editor.openElementInTextEditor',
    (editorDocument: EditorDocument, elementId: string) => {
      const xml: string = editorDocument.data.original;
      const regex = new RegExp(`\\sid="${elementId}"`, 'gim');
      const index = xml.search(regex) + 5;

      const xmlBeforeIndex = xml.substr(0, index).split('\n');
      const lineNo = xmlBeforeIndex.length;
      const column = xmlBeforeIndex[lineNo - 1].length + 1;

      bifrost.commands.executeCommand('std.shell.openDocumentInTextEditor', [editorDocument, lineNo, column]);
    },
    {
      enabledWhen: (editorDocument: EditorDocument): boolean => {
        return bifrost.commands.isCommandEnabled('std.shell.openDocumentInTextEditor', [editorDocument]);
      },
    },
  );

  bifrost.commands.register('bpmn.editor.addCustomColor', async (color: BpmnElementColor) => {
    const customColors: BpmnElementColor[] = bifrost.settings.get('bpmn.editor.customColors') ?? [];
    const dialogOptions: DialogOptions = {
      type: 'custom',
      title: 'Save Custom Color',
      content: [
        {
          type: 'text_input',
          label: 'Color Name',
          id: 'color-name',
          focus: true,
        },
      ],
      actions: [
        {
          response: 'submit',
          label: 'Save',
          default: true,
        },
        {
          response: 'cancel',
          label: 'Cancel',
          cancel: true,
        },
      ],
    };

    const { formData, wasCancelled, response } = await bifrost.dialog.open(dialogOptions, colorNameValidator);

    if (wasCancelled || response !== 'submit') {
      return;
    }

    const newColor: BpmnElementColor = {
      label: (formData as object)['color-name'],
      backgroundColor: color.backgroundColor,
      borderColor: color.borderColor,
    };

    const hasUniqueLabel = (existingColor: BpmnElementColor): boolean => existingColor.label !== newColor.label;
    const hasUniqueValue = (existingColor: BpmnElementColor): boolean =>
      existingColor.backgroundColor !== newColor.backgroundColor || existingColor.borderColor !== newColor.borderColor;

    const newCustomColors = customColors.filter(hasUniqueLabel).filter(hasUniqueValue).concat(newColor);
    bifrost.settings.set('bpmn.editor.customColors', newCustomColors);
  });

  // --- BPMN merge resolver commands ---

  function getResolverApi(model: any): any | null {
    return model?.resolverRef?.current ?? null;
  }

  bifrost.commands.register('git.merge.zoomToViewport.bpmn', (model: any) => {
    getResolverApi(model)?.zoomToViewport();
  });

  bifrost.commands.register('git.merge.zoomToActualSize.bpmn', (model: any) => {
    getResolverApi(model)?.zoomToActualSize();
  });

  bifrost.commands.register('git.merge.zoomToSelectedElement.bpmn', (model: any) => {
    getResolverApi(model)?.zoomToSelectedElement();
  });

  bifrost.commands.register('git.merge.selectNextConflict.bpmn', (model: any) => {
    getResolverApi(model)?.selectNextConflict();
  });

  bifrost.commands.register('git.merge.selectPreviousConflict.bpmn', (model: any) => {
    getResolverApi(model)?.selectPreviousConflict();
  });

  bifrost.commands.register(
    'git.merge.getCurrentConflictIndex.bpmn',
    (model: any): { current: number | null; total: number } | null => {
      return getResolverApi(model)?.getCurrentConflictIndex() ?? null;
    },
  );

  bifrost.commands.register('git.merge.acceptOursForElement.bpmn', (model: any, elementId: string) => {
    getResolverApi(model)?.acceptOursForElement(elementId);
  });

  bifrost.commands.register('git.merge.acceptTheirsForElement.bpmn', (model: any, elementId: string) => {
    getResolverApi(model)?.acceptTheirsForElement(elementId);
  });

  bifrost.commands.register('git.merge.acceptAllOurs.bpmn', (model: any) => {
    getResolverApi(model)?.acceptAllOurs();
  });

  bifrost.commands.register('git.merge.acceptAllTheirs.bpmn', (model: any) => {
    getResolverApi(model)?.acceptAllTheirs();
  });

  bifrost.commands.register('git.merge.getResolutionProgress.bpmn', (model: any) => {
    return getResolverApi(model)?.getResolutionProgress() ?? null;
  });

  bifrost.commands.register('git.merge.getResultXml.bpmn', async (model: any): Promise<string | null> => {
    return (await getResolverApi(model)?.getResultXml()) ?? null;
  });

  bifrost.commands.register('git.merge.isFullyResolved.bpmn', (model: any): boolean => {
    return getResolverApi(model)?.isFullyResolved() ?? false;
  });

  // ─── Bump Version ────────────────────────────────────────────────

  bifrost.commands.register(
    'bpmn.process.bumpVersion',
    async () => {
      const editorDocument = bifrost.editors.getFocusedEditorDocument();
      if (editorDocument == null || editorDocument.documentType !== BPMN_DOCUMENT_TYPE) {
        return;
      }

      const bpmnDocumentModel = await bifrost.editors.getEditorDocumentModel<BpmnDocumentModel>(editorDocument);
      const participants = bpmnDocumentModel.elements.getByType<BpmnElement_Participant>(BpmnElementType.Participant);
      const changes: { name: string; label: string }[] = [];
      const DEFAULT_VERSION = '1.0.0';

      if (participants.length > 0) {
        for (const participant of participants) {
          if (participant.collapsed || !participant.process) {
            continue;
          }
          const process = participant.process;
          const processName = process.name ?? process.id;
          if (process.version) {
            const newVersion = suggestNextVersion(process.version);
            bpmnDocumentModel.elements.setElementProperty(participant.id, 'process', { version: newVersion });
            changes.push({ name: processName, label: `${process.version} → ${newVersion}` });
          } else {
            bpmnDocumentModel.elements.setElementProperty(participant.id, 'process', { version: DEFAULT_VERSION });
            changes.push({ name: processName, label: `→ ${DEFAULT_VERSION}` });
          }
        }
      } else {
        const processes = bpmnDocumentModel.elements.getByType<BpmnElement_Process>(BpmnElementType.Process);
        for (const process of processes) {
          const processName = process.name ?? process.id;
          if (process.version) {
            const newVersion = suggestNextVersion(process.version);
            bpmnDocumentModel.elements.setElementProperty(process.id, 'process', { version: newVersion });
            changes.push({ name: processName, label: `${process.version} → ${newVersion}` });
          } else {
            bpmnDocumentModel.elements.setElementProperty(process.id, 'process', { version: DEFAULT_VERSION });
            changes.push({ name: processName, label: `→ ${DEFAULT_VERSION}` });
          }
        }
      }

      if (changes.length === 0) {
        return;
      }

      const summary = changes.map((entry) => `${entry.name}: ${entry.label}`).join(', ');
      bifrost.notifications.open({
        type: 'info',
        content: `Version update: ${summary}`,
        source: 'BPMN',
      });
    },
    {
      visibleInSearch: true,
      description: ['BPMN: Bump Version', 'Increment Version'],
      enabledWhen: () => {
        const doc = bifrost.editors.getFocusedEditorDocument();
        return doc?.documentType === BPMN_DOCUMENT_TYPE;
      },
    },
  );
}

function getCurrentlyFocusedBpmnDocumentModel(bifrost: Bifrost): BpmnDocumentModel | null {
  const editorDocument = bifrost.editors.getFocusedEditorDocument();
  assertNotNull(editorDocument, 'editorDocument');

  return bifrost.editors.getEditorDocumentModelIfPresent<BpmnDocumentModel>(editorDocument);
}

const executeAtMostOnceEveryTimeout: any = {};

function executeAtMostOnceEvery(ms: number, callbackFn: () => void): void {
  const key = callbackFn.toString();
  if (executeAtMostOnceEveryTimeout[key] != null) {
    window.clearTimeout(executeAtMostOnceEveryTimeout[key]);
    executeAtMostOnceEveryTimeout[key] = null;
  }

  executeAtMostOnceEveryTimeout[key] = window.setTimeout(callbackFn, ms);
}

function replaceMutatedVowels(input: string): string {
  return input
    .replace(/ä/g, 'ae')
    .replace(/Ä/g, 'Ae')
    .replace(/ö/g, 'oe')
    .replace(/Ö/g, 'Oe')
    .replace(/ü/g, 'ue')
    .replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss');
}

function getInvalidCharactersForBpmnId(input: string): string[] {
  const qNameValidationRegex: RegExp = /^[\w-.]/i;
  const inputCharacters: string[] = input.split('');
  const invalidCharacters: string[] = inputCharacters.filter((character: string) => {
    const characterIsInvalid: boolean = character.match(qNameValidationRegex) == null;

    return characterIsInvalid;
  });

  return invalidCharacters;
}

const colorNameValidator: DialogValidationCallbackFn = async ({ wasCancelled, formData, response }) => {
  if (wasCancelled || response !== 'submit') {
    return { closeDialog: true };
  }

  const colorName = formData?.['color-name'];
  if (colorName == null || colorName.trim().length === 0) {
    return {
      closeDialog: false,
      validationErrors: [{ contentId: 'color-name', errorLabel: 'Color name must not be empty' }],
    };
  }

  return { closeDialog: true };
};
