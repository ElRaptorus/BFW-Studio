import type { RelationLine } from '../buildRelationLines';
import { UPDATE_MAP_COMMAND } from './LandscapeUpdates';
import type LandscapeUpdates from './LandscapeUpdates';

export default class LandscapeContextPadProvider {
  static $inject = ['contextPad', 'modeling', 'connect', 'commandStack', 'landscapeUpdates'];

  private modeling: any;
  private connect: any;
  private commandStack: any;
  private landscapeUpdates: LandscapeUpdates;

  constructor(contextPad: any, modeling: any, connect: any, commandStack: any, landscapeUpdates: LandscapeUpdates) {
    this.modeling = modeling;
    this.connect = connect;
    this.commandStack = commandStack;
    this.landscapeUpdates = landscapeUpdates;
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
