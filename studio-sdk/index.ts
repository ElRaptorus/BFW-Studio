// To interact with the Studio, plugin authors need to use a toolkit which allows them to consume, modify
// and construct their own document types, views, etc.
// These contracts, classes, React components etc. are kept in `src/`
export * from './src';

// since plugin authors are not (and should not) be able to construct a Studio object themselves
// types contains typings for the Studio object, which plugin authors are "handed" in their plugin code
export { Studio } from './types/Studio';

// the same goes for the editor document model of Studio's `bpmn` module
export * from './types/BpmnDocumentModel';
export * from './types/DmnDocumentModel';
