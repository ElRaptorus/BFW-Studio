import { AbstractExampleRenderer } from './AbstractExampleRenderer';

export abstract class JsonExampleRenderer<TRendererProps> extends AbstractExampleRenderer<TRendererProps> {
  protected valueIsValid(value: any): boolean {
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }

  protected getEditorLanguage(): string {
    return 'json';
  }

  protected getDataForModel(data: any): any {
    return JSON.parse(data);
  }

  protected getDataForRenderer(data: any): string {
    return JSON.stringify(data, null, 2);
  }
}
