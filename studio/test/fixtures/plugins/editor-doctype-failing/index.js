// Throws from activate() while declaring contributes.editorDocumentTypes — exercises the
// PlaceholderEditorDocumentRenderer's "failed" terminal state (activation attempted, plugin
// ended up in status 'error'), so an opened .failtest file reports the failure instead of
// spinning on "Activating plugin…" forever.
exports.activate = async () => {
  throw new Error('Intentional activation failure (editor-doctype-failing)');
};
