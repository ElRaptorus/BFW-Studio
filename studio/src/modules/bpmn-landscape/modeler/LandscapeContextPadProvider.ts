export default class LandscapeContextPadProvider {
  static $inject = ['contextPad', 'modeling'];

  private modeling: any;

  constructor(contextPad: any, modeling: any) {
    this.modeling = modeling;
    contextPad.registerProvider(this);
  }

  getContextPadEntries(element: any): Record<string, unknown> {
    return {
      delete: {
        group: 'edit',
        className: 'ph ph-trash',
        title: 'Delete',
        action: { click: () => this.modeling.removeElements([element]) },
      },
    };
  }
}
