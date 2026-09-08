import { createGenericExecutor } from "../base/createGenericExecutor";
import { spotonValidator } from "../base/validators";
import { SkyTabPosSkillSet } from "./skillset";

export const createSkyTabWorkflowExecutor = () =>
  createGenericExecutor("skytab", SkyTabPosSkillSet, {
    validateStaff: spotonValidator,
    validateRewards: spotonValidator,
  });
