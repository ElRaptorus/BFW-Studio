declare type ViewMediator = any;

/**
 * A ViewMediator connects a piece of logic (a view instance) with its specific representation in the DOM
 * (a React component).
 *
 * **IMPORTANT:** Most of the time, we do NOT need this!
 *
 * Most of the time, the presentational layer can be purposefully "dumped down", so that it only shows the information
 * it's given and delegates events back to the logic layer, so that the underlying data can be updated and the
 * presentation be re-rendered.
 *
 * In these cases, we have the view separated from its representation by implementing the logic part
 * (e.g. the class `DialogView`) separatly from the presentational part (e.g. the React component `Dialog`).
 *
 *        DialogView.ts   // logic for filtering items based on input and opening the selected item
 *             |
 *         Dialog.tsx     // representation with positioning etc.; delegates inputs back up to the view
 *             |
 *    DialogRenderer.tsx  // pure rendering, used for docs and easier testing
 *
 * But in some instances, we need to connect different instances of a "DOM thing" to their counterparts in the logic
 * layer. While there is only one central Dialog component in the whole of Studio, there are multiple Tree components
 * which all have to be able to e.g. receive keyboard inputs through the abstractions of keybindings and commands.
 *
 * This is important because keyboard inputs mean different things on different operating systems
 * (think "ENTER", "SPACE" and "F2" in a Tree component).
 *
 *        TreeView.ts      // logic for filtering, collapsing and expanding items and opening the selected item
 *            |
 *    TreeViewMediator.ts
 *            |
 *         Tree.tsx        // representation with positioning etc.
 *            |            // delegates inputs back up to the view, through the ViewMediator
 *            |
 *     TreeRenderer.tsx    // pure rendering, used for docs and easier testing
 *
 * ViewMediators provide the ability to say
 *
 * > If something happens in the focused DOM node, give me the view for the component containing that DOM node.
 *
 */
export declare class ViewMediatorManager {
  /**
   * Registers a given `viewMediator` with the given `viewMediatorId`.
   *
   * Example:
   *
   *    studio.views.registerViewMediator('std/foo-mediator', new FooViewMediator())
   */
  registerViewMediator(viewMediatorId: string, viewMediator: ViewMediator): ViewMediator;

  /**
   * Gets a ViewMediator compatible with a given `viewMediatorConstructor` for a given `element`.
   *
   * The element must be part of the DOM tree of the ViewMediator.
   *
   * Example:
   *
   *    onKeyDown = (event) => {
   *      const foo = studio.views.getByDomNode<FooMediator>(FooMediator, event.target);
   *      foo.bar();
   *    }
   *
   */
  getByDomNode<T = ViewMediator>(
    viewMediatorConstructor: abstract new (...args: any[]) => any,
    element: HTMLElement,
  ): T;

  /**
   * Gets a ViewMediator for a given `viewMediatorId`.
   *
   * Example:
   *
   *    > studio.views.getById('std/quick-jump')
   *    > studio.views.getById<QuickJumpViewMediator>('std/quick-jump')
   */
  getById<T = ViewMediator>(viewMediatorId: string): T;

  /**
   * Gets a ViewMediator for a given `viewMediatorId` or registers the output of the given `viewMediatorFactoryFn`.
   *
   * Example:
   *
   *    studio.views.getOrRegisterById('std/foo-mediator', () => new FooViewMediator())
   */
  getOrRegisterById<T = ViewMediator>(viewMediatorId: string, viewMediatorFactoryFn: (...args: any[]) => any): T;

  /**
   * Returns `true` if a ViewMediator with the given `viewMediatorId` is registered.
   *
   * Example:
   *
   *    studio.views.isRegistered('std/foo-mediator')
   */
  isRegistered(viewMediatorId: string): boolean;

  /**
   * Waits until a ViewMediator with the given `viewMediatorId` is registered, then returns it.
   *
   * If the ViewMediator is already registered, resolves immediately.
   * Rejects after `timeoutMs` if the ViewMediator has not appeared.
   *
   * Use this when a preceding operation (e.g. making a pane area visible) triggers a React
   * render that will mount the component owning the ViewMediator, but you cannot know when
   * the render completes.
   *
   * Example:
   *
   *    studio.panes.setVisibilityOfPaneAreaByPaneId('inspectors/editor_document_inspector', true);
   *    const treeview = await studio.views.waitForAndGetById<TreeViewMediator>('editorInspector');
   */
  waitForAndGetById<T = ViewMediator>(viewMediatorId: string, timeoutMs?: number): Promise<T>;
}
