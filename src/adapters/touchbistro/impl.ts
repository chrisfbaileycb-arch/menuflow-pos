import { createGenericExecutor } from "../base/createGenericExecutor";
import { TouchBistroPosSkillSet } from "./skillset";

export const createTouchBistroWorkflowExecutor = () =>
  createGenericExecutor("touchbistro", TouchBistroPosSkillSet);
