import { createGenericExecutor } from "../base/createGenericExecutor";
import { RevelPosSkillSet } from "./skillset";

export const createRevelWorkflowExecutor = () =>
  createGenericExecutor("revel", RevelPosSkillSet);
