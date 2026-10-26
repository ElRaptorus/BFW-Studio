import CreateMoveSnapping from 'diagram-js/lib/features/snapping/CreateMoveSnapping';

/** Relation lines are derived from the solution, so their bends are no place for a shape to snap to. */
export default class LandscapeSnapping extends CreateMoveSnapping {
  getSnapTargets(shape: any, target: any): any[] {
    return super.getSnapTargets(shape, target).filter((snapTarget: any) => snapTarget.type !== 'relation');
  }
}
