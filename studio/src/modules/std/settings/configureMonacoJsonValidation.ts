import type { Bifrost } from '#bifrost/Bifrost';

import { buildJsonSchema } from './validation/schemaToJsonSchema';

let cachedJsonModule: any = null;

export function configureMonacoJsonValidation(studio: Bifrost): void {
  const apply = (jsonModule: any): void => {
    cachedJsonModule = jsonModule;
    const schemas = studio.settings.getSchemas();
    const jsonSchema = buildJsonSchema(schemas);

    jsonModule.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: true,
      trailingCommas: 'ignore',
      schemas: [
        {
          uri: 'internal://settings-schema.json',
          fileMatch: ['about:user-settings.json'],
          schema: jsonSchema,
        },
      ],
    });
  };

  if (cachedJsonModule != null) {
    apply(cachedJsonModule);
    return;
  }

  import('monaco-editor/language/json/monaco.contribution').then(apply);
}
