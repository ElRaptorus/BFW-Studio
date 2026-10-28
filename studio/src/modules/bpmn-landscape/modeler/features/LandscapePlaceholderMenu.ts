import type { LandscapeRendererConfig } from '../LandscapeRenderer';
import { popupEntry, popupPositionOf } from '../LandscapeReplaceMenuProvider';

const PROVIDER_ID = 'landscape-placeholder';
const POPUP_WIDTH = 300;

/**
 * The context pad entry "Model or link a process" of a placeholder and its popup. The right-click menu offers the
 * same two actions; both run the commands `bpmn.landscape.modelPlaceholder` and `bpmn.landscape.linkPlaceholder`.
 */
class LandscapePlaceholderMenu {
  static $inject = ['contextPad', 'popupMenu', 'elementRegistry', 'config.landscape'];

  constructor(
    private readonly contextPad: any,
    private readonly popupMenu: any,
    private readonly elementRegistry: any,
    private readonly config: LandscapeRendererConfig,
  ) {
    contextPad.registerProvider(this);
    popupMenu.registerProvider(PROVIDER_ID, this);
  }

  getContextPadEntries(element: any): Record<string, unknown> {
    if (element.type !== 'placeholder') {
      return {};
    }
    return {
      'placeholder-actions': {
        group: 'edit',
        className: 'ph ph-link',
        title: 'Model or link a process',
        action: { click: (event: MouseEvent) => this.open(element, { x: event.x, y: event.y }) },
      },
    };
  }

  getPopupMenuEntries(element: any): Record<string, unknown> {
    const group = { id: 'placeholder', name: 'Process' };
    const canLink = this.config.hasFreeProcesses();
    return {
      'placeholder-model': {
        ...popupEntry({ label: 'Model this process…', description: 'Create a BPMN file for it', icon: 'ph-plus' }),
        group,
        action: () => this.config.runPlaceholderAction('model', element.id),
      },
      'placeholder-link': {
        ...popupEntry({
          label: 'Link to existing process…',
          description: canLink
            ? 'Choose a process of the solution'
            : 'Every process of the solution is already on this map',
          icon: 'ph-link',
        }),
        group,
        disabled: !canLink,
        action: () => this.config.runPlaceholderAction('link', element.id),
      },
    };
  }

  private open(element: any, cursor: { x: number; y: number }): void {
    this.popupMenu.open(element, PROVIDER_ID, popupPositionOf(element, this.contextPad, this.elementRegistry, cursor), {
      title: 'Placeholder',
      width: POPUP_WIDTH,
    });
  }
}

export default {
  __init__: ['landscapePlaceholderMenu'],
  landscapePlaceholderMenu: ['type', LandscapePlaceholderMenu],
};
