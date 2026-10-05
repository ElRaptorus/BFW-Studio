/** Result item of `dmn.project.getAllReachableDmnModels`. */
export type ProjectDmnModel = {
  definitionsId: string;
  name: string;
  filename: string;
};

/** Result item of `dmn.project.getAllDecisionsForDmnModel`. */
export type ProjectDmnDecision = {
  decisionId: string;
  name: string;
};
