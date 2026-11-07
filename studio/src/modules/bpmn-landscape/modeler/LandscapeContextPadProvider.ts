import type LandscapeCollapse from './LandscapeCollapse';
import type LandscapeDrilldown from './LandscapeDrilldown';
import type LandscapeReplaceMenuProvider from './LandscapeReplaceMenuProvider';
import { isCollapsedGroup } from './landscapeHierarchy';

export default class LandscapeContextPadProvider {
  static $inject = [
    'contextPad',
    'modeling',
    'connect',
    'landscapeCollapse',
    'landscapeDrilldown',
    'landscapeReplaceMenu',
    'rules',
  ];

  private modeling: any;
  private rules: any;
  private connect: any;
  private landscapeCollapse: LandscapeCollapse;
  private landscapeDrilldown: LandscapeDrilldown;
  private landscapeReplaceMenu: LandscapeReplaceMenuProvider;

  constructor(
    contextPad: any,
    modeling: any,
    connect: any,
    landscapeCollapse: LandscapeCollapse,
    landscapeDrilldown: LandscapeDrilldown,
    landscapeReplaceMenu: LandscapeReplaceMenuProvider,
    rules: any,
  ) {
    this.modeling = modeling;
    this.rules = rules;
    this.connect = connect;
    this.landscapeCollapse = landscapeCollapse;
    this.landscapeDrilldown = landscapeDrilldown;
    this.landscapeReplaceMenu = landscapeReplaceMenu;
    contextPad.registerProvider(this);
  }

  getContextPadEntries(element: any): Record<string, unknown> {
    const entries: Record<string, unknown> = {
      delete: {
        group: 'edit',
        className: 'bpmn-icon-trash',
        title: 'Delete',
        action: { click: () => this.modeling.removeElements([element]) },
      },
    };
    if (this.landscapeReplaceMenu.canReplace(element)) {
      entries.replace = {
        group: 'edit',
        className: 'bpmn-icon-screw-wrench',
        title: 'Change element',
        action: {
          click: (event: MouseEvent) => this.landscapeReplaceMenu.open(element, { x: event.x, y: event.y }),
        },
      };
    }
    if (element.type === 'group') {
      const isCollapsed = isCollapsedGroup(element);
      entries.toggleCollapse = {
        group: 'hierarchy',
        className: isCollapsed ? 'bpmn-icon-subprocess-expanded' : 'bpmn-icon-subprocess-collapsed',
        title: isCollapsed ? 'Expand' : 'Collapse',
        action: { click: () => this.landscapeCollapse.toggle(element) },
      };
      if (isCollapsed) {
        entries.open = {
          group: 'hierarchy',
          className: 'ph ph-arrows-out-simple',
          title: 'Open',
          action: { click: () => this.landscapeDrilldown.open(element) },
        };
      }
    }
    if (element.waypoints == null && element.type !== 'band') {
      const start = (event: Event) => this.connect.start(event, element);
      entries.connect = {
        group: 'connect',
        className: 'bpmn-icon-connection-multi',
        title: 'Connect',
        action: { click: start, dragstart: start },
      };
    }
    return entries;
  }

  /** The `elements.delete` rule leaves hidden connectors out of a selection. */
  getMultiElementContextPadEntries(elements: any[]): Record<string, unknown> {
    const allowed = this.rules.allowed('elements.delete', { elements });
    if (allowed === false) {
      return {};
    }
    const removable: any[] = Array.isArray(allowed) ? allowed : elements;
    return {
      delete: {
        group: 'edit',
        className: 'bpmn-icon-trash',
        title: 'Delete',
        action: { click: () => this.modeling.removeElements(removable.slice()) },
      },
    };
  }
}
