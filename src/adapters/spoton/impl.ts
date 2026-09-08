import { createGenericExecutor } from "../base/createGenericExecutor";
import { spotonValidator } from "../base/validators";
import { SpotOnPosSkillSet } from "./skillset";

export const createSpotOnWorkflowExecutor = () =>
  createGenericExecutor("spoton", SpotOnPosSkillSet, {
    validateStaff: spotonValidator,
    validateRewards: spotonValidator,
  });
