import { createGenericExecutor } from "../base/createGenericExecutor";
import { alohaValidator } from "../base/validators";
import { AlohaPosSkillSet } from "./skillset";

export const createAlohaWorkflowExecutor = () =>
  createGenericExecutor("aloha", AlohaPosSkillSet, {
    validateStaff: alohaValidator,
    validateRewards: alohaValidator,
  });
