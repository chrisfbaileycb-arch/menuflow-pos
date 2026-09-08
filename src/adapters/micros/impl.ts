import { createGenericExecutor } from "../base/createGenericExecutor";
import { MicrosPosSkillSet } from "./skillset";

export const createMicrosWorkflowExecutor = () =>
  createGenericExecutor("micros", MicrosPosSkillSet);
