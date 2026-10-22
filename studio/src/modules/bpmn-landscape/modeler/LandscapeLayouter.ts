import BaseLayouter from 'diagram-js/lib/layout/BaseLayouter';
import { getMid } from 'diagram-js/lib/layout/LayoutUtil';
import { repairConnection } from 'diagram-js/lib/layout/ManhattanLayout';

/** Lays connectors out as right-angled lines and crops them at the shape outlines. */
export default class LandscapeLayouter extends BaseLayouter {
  static $inject = ['connectionDocking'];

  private connectionDocking: any;

  constructor(connectionDocking: any) {
    super();
    this.connectionDocking = connectionDocking;
  }

  layoutConnection(connection: any, hints: any = {}): any[] {
    const source = hints.source ?? connection.source;
    const target = hints.target ?? connection.target;
    const waypoints = repairConnection(
      source,
      target,
      hints.connectionStart ?? getMid(source),
      hints.connectionEnd ?? getMid(target),
      connection.waypoints,
      { preferredLayouts: ['h:h'], ...hints },
    );
    return this.connectionDocking.getCroppedWaypoints({ ...connection, waypoints }, source, target);
  }
}
