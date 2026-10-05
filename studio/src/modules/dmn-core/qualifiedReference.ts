/** `namespace#elementId` points into an imported model; anything else is local. Mirrors `QualifiedReference` in the Engine. */
export function isImportedReference(reference: string): boolean {
  const separatorIndex = reference.indexOf('#');
  return separatorIndex > 0 && separatorIndex < reference.length - 1;
}

export function splitQualifiedReference(reference: string): { namespace: string | null; elementId: string } {
  if (!isImportedReference(reference)) {
    return { namespace: null, elementId: reference.replace(/^#/, '') };
  }
  const separatorIndex = reference.indexOf('#');
  return { namespace: reference.slice(0, separatorIndex), elementId: reference.slice(separatorIndex + 1) };
}
