import { AbstractEmitter, getClosestMatch } from '@evil/bifrost_fw_sdk';

type ViewMediator = any;

const DEBUG_FILTER_REGEX = /^(UNSAFE_|__)/g;
const EVENT_VIEW_MEDIATOR_REGISTERED = 'EVENT_VIEW_MEDIATOR_REGISTERED';

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
 * layer. While there is only one central Dialog component in the whole of Bifrost, there are multiple Tree components
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
export class ViewMediatorManager extends AbstractEmitter {
  private viewMediators: any = {};

  /**
   * Registers a given `viewMediator` with the given `viewMediatorId`.
   *
   * Example:
   *
   *    bifrost.views.registerViewMediator('std/foo-mediator', new FooViewMediator())
   */
  registerViewMediator(viewMediatorId: string, viewMediator: ViewMediator): ViewMediator {
    if (viewMediatorId == null || viewMediatorId === '') {
      throw new Error(`Can not register ViewMediator with an empty id: ${viewMediator.constructor.name}`);
    }
    if (this.viewMediators[viewMediatorId] != null) {
      throw new Error(`ViewMediator already registered: ${viewMediatorId}`);
    }

    this.viewMediators[viewMediatorId] = viewMediator;

    this.emit(EVENT_VIEW_MEDIATOR_REGISTERED, [viewMediatorId]);

    return viewMediator;
  }

  /**
   * Gets a ViewMediator compatible with a given `viewMediatorConstructor` for a given `element`.
   *
   * The element must be part of the DOM tree of the ViewMediator.
   *
   * Example:
   *
   *    onKeyDown = (event) => {
   *      const foo = bifrost.views.getByDomNode<FooMediator>(FooMediator, event.target);
   *      foo.bar();
   *    }
   *
   */
  getByDomNode<T = ViewMediator>(viewMediatorConstructor: new (...args: any[]) => any, element: HTMLElement): T {
    if (element == null) {
      throw new Error(`Could not find ViewMediator by DOM node: no element given`);
    }
    const result = Object.values(this.viewMediators).find((viewMediator: ViewMediator) =>
      this.matches(viewMediator.domSelector, element),
    );
    if (result == null) {
      console.error(
        `Could not find ViewMediator '${viewMediatorConstructor.name}' by DOM node: `,
        element,
        ` in `,
        this.viewMediators,
      );
      throw new Error(`Could not find ViewMediator by DOM node: ${viewMediatorConstructor.name}`);
    }

    return result as T;
  }

  /**
   * Gets a ViewMediator for a given `viewMediatorId`.
   *
   * Example:
   *
   *    > bifrost.views.getById('std/quick-jump')
   *    > bifrost.views.getById<QuickJumpViewMediator>('std/quick-jump')
   */
  getById<T = ViewMediator>(viewMediatorId: string): T {
    const viewMediator = this.viewMediators[viewMediatorId];
    if (viewMediator == null) {
      throw new Error(this.getViewMediatorNotFoundErrorMessage(viewMediatorId));
    }

    return viewMediator;
  }

  /**
   * Gets a ViewMediator for a given `viewMediatorId` or registers the output of the given `viewMediatorFactoryFn`.
   *
   * Example:
   *
   *    bifrost.views.getOrRegisterById('std/foo-mediator', () => new FooViewMediator())
   */
  getOrRegisterById<T = ViewMediator>(viewMediatorId: string, viewMediatorFactoryFn: () => T): T {
    const viewMediator: T = this.viewMediators[viewMediatorId];
    if (viewMediator != null) {
      return viewMediator;
    }

    const newViewMediator: T = viewMediatorFactoryFn.apply(null, []);

    this.registerViewMediator(viewMediatorId, newViewMediator);

    return newViewMediator;
  }

  /**
   * Returns `true` if a ViewMediator with the given `viewMediatorId` is registered.
   *
   * Example:
   *
   *    bifrost.views.isRegistered('std/foo-mediator')
   */
  isRegistered(viewMediatorId: string): boolean {
    return this.viewMediators[viewMediatorId] != null;
  }

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
   *    bifrost.panes.setVisibilityOfPaneAreaByPaneId('inspectors/editor_document_inspector', true);
   *    const treeview = await bifrost.views.waitForAndGetById<TreeViewMediator>('editorInspector');
   */
  async waitForAndGetById<T = ViewMediator>(viewMediatorId: string, timeoutMs: number = 5000): Promise<T> {
    if (this.viewMediators[viewMediatorId] != null) {
      return this.viewMediators[viewMediatorId] as T;
    }

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        subscription.dispose();
        reject(new Error(`Timed out waiting for ViewMediator '${viewMediatorId}' to be registered.`));
      }, timeoutMs);

      const subscription = this.on(EVENT_VIEW_MEDIATOR_REGISTERED, (registeredId: string) => {
        if (registeredId === viewMediatorId) {
          clearTimeout(timeout);
          subscription.dispose();
          resolve(this.viewMediators[viewMediatorId] as T);
        }
      });
    });
  }

  debug(viewMediatorId: string, filterData: boolean = true): void {
    if (!this.isRegistered(viewMediatorId)) {
      console.log('There is no ViewMediator registered with this id.');
      return;
    }

    const viewMediator = this.getById(viewMediatorId);

    const data = JSON.parse(JSON.stringify(viewMediator.getViewData()));

    if (filterData) {
      this.traverse(data, (item: any) => {
        for (const field of Object.keys(item)) {
          if (field.match(DEBUG_FILTER_REGEX)) {
            delete item[field];
          }
        }
      });
    }

    console.log(`==== LIVE OBJECT ===============================================`);
    console.log('');
    console.log(viewMediator);
    console.log('');
    if (filterData) {
      console.log(`==== DATA (filtered, use \`bifrost.views.debug('${viewMediatorId}', false)\` for unfiltered data)`);
    } else {
      console.log('==== DATA (unfiltered) ==========================================');
    }
    console.log('');
    console.log(JSON.stringify(data, null, 2));
  }

  private traverse(item: any, callbackFn: (item: any) => void): void {
    if (item == null) {
      return;
    }

    if (Array.isArray(item)) {
      item.forEach((child: any) => this.traverse(child, callbackFn));
    } else {
      callbackFn.apply(null, [item]);

      if (typeof item === 'object') {
        for (const field of Object.keys(item)) {
          const child = item[field];
          this.traverse(child, callbackFn);
        }
      }
    }
  }

  private getViewMediatorNotFoundErrorMessage(id: string): string {
    const ids = Object.keys(this.viewMediators);
    const suggestion = getClosestMatch(id, ids);

    return `ViewMediator '${id}' is not registered. Did you mean '${suggestion}'?`;
  }

  private matches(potentialParentSelector: string, element: Element): boolean {
    return element.matches(`${potentialParentSelector}, ${potentialParentSelector} ${element.nodeName}`);
  }
}
