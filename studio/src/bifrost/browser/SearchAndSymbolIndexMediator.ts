import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import {
  EVENT_EDITOR_AREA_DOCUMENT_CLOSED,
  EVENT_EDITOR_DOCUMENT_DATA_UPDATED,
  EVENT_EDITOR_DOCUMENT_URI_UPDATED,
} from '#bifrost/contracts/internal/EditorEvents';
import type { ISearchIndex } from '#bifrost/contracts/internal/SearchTypes';

import type { FileHandlingService } from '../common/FileHandlingService';
import type { Performance } from '../common/Performance';
import { isUriIncludedInSolution } from '../common/SolutionFunctions';
import { EVENT_SOLUTION_CHANGED } from '../common/SolutionManager';
import type { SolutionMediator } from '../common/SolutionMediator';
import type { Solution } from '../contracts/SolutionTypes';
import type { ISymbolIndex } from '../contracts/SymbolTypes';
import type { EditorMediator } from './EditorMediator';

export class SearchAndSymbolIndexMediator {
  private searchIndex: ISearchIndex;
  private symbolIndex: ISymbolIndex;
  private currentProjectUris: Set<string> = new Set();
  private editors: EditorMediator;
  private files: FileHandlingService;
  private solutionMediator: SolutionMediator;
  private performance: Performance;

  constructor(
    performance: Performance,
    editors: EditorMediator,
    files: FileHandlingService,
    solutionMediator: SolutionMediator,
    searchIndex: ISearchIndex,
    symbolIndex: ISymbolIndex,
  ) {
    this.performance = performance;
    this.editors = editors;
    this.files = files;
    this.solutionMediator = solutionMediator;
    this.searchIndex = searchIndex;
    this.symbolIndex = symbolIndex;

    solutionMediator.on(EVENT_SOLUTION_CHANGED, (solution: Solution) => {
      this.onSolutionChanged(solution);
    });

    editors.on(EVENT_EDITOR_DOCUMENT_DATA_UPDATED, (editorDocument: EditorDocument) => {
      this.onEditorDocumentChanged(editorDocument);
    });

    editors.on(EVENT_EDITOR_DOCUMENT_URI_UPDATED, (editorUriBefore, editorUriAfter) => {
      this.onEditorDocumentClosed(editorUriBefore);
      const editorDocument = editors.getEditorDocumentByUri(editorUriAfter);
      if (editorDocument != null) {
        this.onEditorDocumentChanged(editorDocument);
      }
    });

    editors.on(EVENT_EDITOR_AREA_DOCUMENT_CLOSED, (editorDocument: EditorDocument) => {
      this.onEditorDocumentClosed(editorDocument);
    });
  }

  clearIndex(): void {
    this.searchIndex.clearIndex();
    this.symbolIndex.clearIndex();
  }

  async index(uri: string, documentType: string, currentData: string): Promise<void> {
    try {
      await this.searchIndex.index(uri, documentType, currentData);
      await this.symbolIndex.index(uri, documentType, currentData);
    } catch (error) {
      console.error('Indexing document timed out.', {
        uri: uri,
        documentType: documentType,
        currentData: currentData,
        error: error,
      });
    }
  }

  private async onEditorDocumentClosed(editorDocumentOrUri: EditorDocument | string): Promise<void> {
    const editorDocumentUri = typeof editorDocumentOrUri === 'string' ? editorDocumentOrUri : editorDocumentOrUri.uri;
    const documentIsInOpenedSolution = this.solutionMediator.containsEditorDocumentWithUri(editorDocumentUri);

    if (documentIsInOpenedSolution) {
      return;
    }
    this.searchIndex.clearIndexByUri(editorDocumentUri);
    this.symbolIndex.clearIndexByUri(editorDocumentUri);
  }

  private async onEditorDocumentChanged(editorDocument: EditorDocument): Promise<void> {
    const data = editorDocument.data?.current;

    if (data != null) {
      this.symbolIndex.lock(`indexing document: ${editorDocument.uri}`);

      this.index(editorDocument.uri, editorDocument.documentType, data);

      this.symbolIndex.unlock();
    }
  }

  private async onSolutionChanged(solution: Solution | null): Promise<void> {
    if (solution == null) {
      for (const oldProjectUri of this.currentProjectUris) {
        this.searchIndex.clearIndexBySolutionUri(oldProjectUri);
        this.symbolIndex.clearIndexBySolutionUri(oldProjectUri);
      }
      this.currentProjectUris = new Set();
      return;
    }

    const newProjectUris = new Set(solution.projects.map((project) => project.baseUri));

    for (const oldProjectUri of this.currentProjectUris) {
      if (!newProjectUris.has(oldProjectUri)) {
        this.searchIndex.clearIndexBySolutionUri(oldProjectUri);
        this.symbolIndex.clearIndexBySolutionUri(oldProjectUri);
      }
    }

    this.currentProjectUris = newProjectUris;

    this.performance.mark(`bifrost:files:index-solution ${solution.baseUri} #start`);

    this.symbolIndex.lock(`indexing solution: ${solution.name}`);

    for (const project of solution.projects) {
      const filesToIndex: any[] = [];

      await this.files.traverseProject(project, async (fileOrDirectory) => {
        if (
          fileOrDirectory.type === 'file' &&
          this.editors.hasDocumentTypeDefinitionForUri(fileOrDirectory.uri) &&
          isUriIncludedInSolution(solution, fileOrDirectory.uri)
        ) {
          filesToIndex.push(fileOrDirectory.uri);
        }

        return fileOrDirectory;
      });

      const fileCountToIndex = filesToIndex.length;
      let fileCountIndexed = 0;

      const mapPromises = filesToIndex.map(async (resultUri: string) => {
        let data: string | null = null;
        try {
          data = await this.files.load(resultUri);
        } catch {
          // File may have been moved or deleted since the traversal
        }

        if (data != null) {
          const editorDocumentTypeDefinition = this.editors.getDocumentTypeDefinitionByUri(resultUri);
          await this.index(resultUri, editorDocumentTypeDefinition.documentType, data);
        }

        fileCountIndexed++;
        if (fileCountIndexed === fileCountToIndex) {
          this.performance.mark(`bifrost:files:index-solution ${solution.baseUri} #end`);
        }
      });

      await Promise.all(mapPromises);
    }

    this.symbolIndex.unlock();

    this.performance.mark(`bifrost:files:open-solution ${solution.baseUri} #end`);
  }
}
