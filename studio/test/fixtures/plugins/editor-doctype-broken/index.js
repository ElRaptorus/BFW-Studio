// Deliberately does NOT call api.editors.registerWebviewDocumentType() for the "broken"
// document type declared in package.json's contributes.editorDocumentTypes — this is the
// "plugin bug" the PlaceholderEditorDocumentRenderer's mismatch terminal state guards against.
exports.activate = async () => {
  console.log('[editor-doctype-broken] activated (intentionally registers no editor)');
};

exports.deactivate = () => {
  console.log('[editor-doctype-broken] deactivated');
};
