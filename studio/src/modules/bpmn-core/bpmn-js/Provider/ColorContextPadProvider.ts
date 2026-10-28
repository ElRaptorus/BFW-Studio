import type { SettingsMediator } from '#bifrost/common/SettingsMediator';
import type { BpmnElementColor } from '#modules/bpmn-core/BpmnElementCoreTypes';
import { PREDEFINED_COLORS } from '#modules/bpmn-core/components/BpmnElementColorPicker';
import type EventBus from 'diagram-js/lib/core/EventBus';
import type { ElementLike } from 'diagram-js/lib/model/Types';

const noColor = {
  label: 'No Color',
  backgroundColor: undefined,
  borderColor: undefined,
};

export class ColorContextPadProvider {
  static $inject = ['contextPad', 'modeling', 'canvas', 'eventBus'];
  private settings: SettingsMediator | null = null;
  private documentUri: () => string = () => '';

  private contextPad: any;
  private modeling;
  private canvas: any;
  private panel: HTMLDivElement | null = null;

  constructor(contextPad: any, modeling, canvas: any, eventBus: EventBus) {
    this.contextPad = contextPad;
    this.modeling = modeling;
    this.canvas = canvas;
    contextPad.registerProvider(this);
    // The panel is positioned once, below the pad; it would stay behind when the canvas scrolls.
    eventBus.on(['selection.changed', 'canvas.viewbox.changing'], () => this.closeColorPicker());
  }

  setSettings(settings: SettingsMediator, documentUri: () => string) {
    this.settings = settings;
    this.documentUri = documentUri;
  }

  getContextPadEntries(element: ElementLike) {
    return (entries) => {
      entries['custom-color-picker'] = {
        group: 'edit',
        className: 'ph-fill ph-palette',
        title: 'Choose color',
        action: {
          click: () => this.openColorPicker(element),
        },
      };
      return entries;
    };
  }

  openColorPicker(element: ElementLike) {
    if (this.panel || !this.contextPad.isOpen(element)) {
      this.closeColorPicker();
      return;
    }

    const availableColors: BpmnElementColor[] = [noColor, ...PREDEFINED_COLORS];
    const customColors =
      (this.settings?.get('bpmn.editor.customColors', this.documentUri()) as BpmnElementColor[] | undefined) ?? [];
    for (const color of customColors) {
      if (!availableColors.some((existing) => existing.label === color.label)) {
        availableColors.push(color);
      }
    }

    this.panel = document.createElement('div');
    this.panel.classList.add('color-picker-panel');

    availableColors.forEach((color) => {
      const btn = document.createElement('div');
      btn.classList.add('color-option');
      btn.style.backgroundColor = color.backgroundColor!;
      if (color.label !== 'No Color') {
        btn.style.borderColor = color.borderColor!;
      }

      btn.onclick = () => {
        this.applyColor(element, color);
        this.closeColorPicker();
      };

      this.panel!.appendChild(btn);
    });

    const editorContent = this.editorContent();
    editorContent.appendChild(this.panel);

    const padRect = this.contextPad.getPad(element).html.getBoundingClientRect();
    const editorRect = editorContent.getBoundingClientRect();
    this.panel.style.position = 'absolute';
    this.panel.style.left = padRect.left - editorRect.left + 'px';
    this.panel.style.top = padRect.bottom - editorRect.top + 5 + 'px';
  }

  /** `color` without colours is "No Color". */
  protected applyColor(element: ElementLike, color: BpmnElementColor) {
    this.modeling.setColor(element, { fill: color.backgroundColor, stroke: color.borderColor });
  }

  closeColorPicker() {
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
  }

  /** The editor that shows this canvas; several editors can be open side by side. */
  private editorContent(): HTMLElement {
    const container: HTMLElement = this.canvas.getContainer();
    return container.closest<HTMLElement>('.editor__content') ?? container.parentElement ?? document.body;
  }
}

export default {
  __init__: ['colorContextPadProvider'],
  colorContextPadProvider: ['type', ColorContextPadProvider],
};
