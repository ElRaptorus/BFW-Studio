export declare type RecentlyOpenedEditorDocument = {
  uri: string;
  icon?: string;
  label?: string;
};

export declare type RecentlyOpenedFile = {
  uri: string;
  icon?: string;
  label?: string;
};

export declare type RecentlyOpenedSolutionItem = {
  uri: string;
};

/**
 * The `RecentlyOpenedMediator` connects an instance of `RecentlyOpenedManager` and an instance for storing its
 * session state.
 *
 * This is done so that the `Manager`, which knows about holding, interpreting and discarding information,
 * does not need to know about storing information, which is the job of the `Storage` class.
 *
 * We gain more clarity about the jobs by separating the two (there are other benefits as well, such as being able to
 * independently test both classes).
 *
 * But since our app wants to manage *and* store information, we implement a `Mediator` class which brings the two
 * together and provides a fascade for those functions that should be exposed at the app-level.
 */
export declare class RecentlyOpenedMediator {
  /**
   * Returns all recently opened editor documents.
   */
  getRecentlyOpenedEditorDocumentItems(): RecentlyOpenedEditorDocument[];

  /**
   * Returns all recently opened solutions.
   */
  getRecentlyOpenedSolutions(): RecentlyOpenedSolutionItem[];

  /**
   * Returns all recently opened files.
   */
  getRecentlyOpenedFiles(): RecentlyOpenedFile[];
}
