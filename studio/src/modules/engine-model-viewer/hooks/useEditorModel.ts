import { useEffect, useState } from 'react';

import type { EditorDocument, EditorDocumentModel, Studio } from '@evil/bifrost_fw_sdk';

export function useEditorModel<T extends EditorDocumentModel>(
  studio: Studio,
  editorDocument: EditorDocument,
): T | null {
  const [model, setModel] = useState<T | null>(() => studio.editors.getEditorDocumentModelIfPresent<T>(editorDocument));

  useEffect(() => {
    if (model) {
      return;
    }
    let cancelled = false;
    studio.editors.getEditorDocumentModel<T>(editorDocument).then((resolved) => {
      if (!cancelled) {
        setModel(resolved);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [studio, editorDocument, model]);

  return model;
}
