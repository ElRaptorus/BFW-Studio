import type { RelationLine } from '../buildRelationLines';
import type LandscapeCollapse from './LandscapeCollapse';
import type LandscapeDrilldown from './LandscapeDrilldown';
import type LandscapeReplaceMenuProvider from './LandscapeReplaceMenuProvider';
import { UPDATE_MAP_COMMAND } from './LandscapeUpdates';
import type LandscapeUpdates from './LandscapeUpdates';
import { isCollapsedGroup } from './landscapeHierarchy';

export default class LandscapeContextPadProvider {
  static $inject = [
    'contextPad',
    'modeling',
    'connect',
    'commandStack',
    'landscapeUpdates',
    'landscapeCollapse',
    'landscapeDrilldown',
    'landscapeReplaceMenu',
  ];

  private modeling: any;
  private connect: any;
  private commandStack: any;
  private landscapeUpdates: LandscapeUpdates;
  private landscapeCollapse: LandscapeCollapse;
  private landscapeDrilldown: LandscapeDrilldown;
  private landscapeReplaceMenu: LandscapeReplaceMenuProvider;

  constructor(
    contextPad: any,
    modeling: any,
    connect: any,
    commandStack: any,
    landscapeUpdates: LandscapeUpdates,
    landscapeCollapse: LandscapeCollapse,
    landscapeDrilldown: LandscapeDrilldown,
    landscapeReplaceMenu: LandscapeReplaceMenuProvider,
  ) {
    this.modeling = modeling;
    this.connect = connect;
    this.commandStack = commandStack;
    this.landscapeUpdates = landscapeUpdates;
    this.landscapeCollapse = landscapeCollapse;
    this.landscapeDrilldown = landscapeDrilldown;
    this.landscapeReplaceMenu = landscapeReplaceMenu;
    contextPad.registerProvider(this);
  }

  getContextPadEntries(element: any): Record<string, unknown> {
    if (element.type === 'relation') {
      return {
        hide: {
          group: 'edit',
          className: 'ph ph-eye-slash',
          title: 'Hide relation',
          action: { click: () => this.hideRelationLine(element.businessObject) },
        },
      };
    }
    const entries: Record<string, unknown> = {
      delete: {
        group: 'edit',
        className: 'ph ph-trash',
        title: 'Delete',
        action: { click: () => this.modeling.removeElements([element]) },
      },
    };
    if (this.landscapeReplaceMenu.canReplace(element)) {
      entries.replace = {
        group: 'edit',
        className: 'ph ph-swap',
        title: 'Change type',
        action: {
          click: (event: MouseEvent) => this.landscapeReplaceMenu.open(element, { x: event.x, y: event.y }),
        },
      };
    }
    if (element.type === 'group') {
      const isCollapsed = isCollapsedGroup(element);
      entries.toggleCollapse = {
        group: 'hierarchy',
        className: isCollapsed ? 'ph ph-arrows-out' : 'ph ph-arrows-in',
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
        className: 'ph ph-arrow-up-right',
        title: 'Connect',
        action: { click: start, dragstart: start },
      };
    }
    return entries;
  }

  private hideRelationLine(line: RelationLine): void {
    const { hiddenRelations } = this.landscapeUpdates.getMapProperties();
    const keys = line.relations.map((relation) => relation.key).filter((key) => !hiddenRelations.includes(key));
    this.commandStack.execute(UPDATE_MAP_COMMAND, { properties: { hiddenRelations: [...hiddenRelations, ...keys] } });
  }
}
