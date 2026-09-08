import { createGenericExecutor } from "../base/createGenericExecutor";
import { squareValidator } from "../base/validators";
import { SquarePosSkillSet } from "./skillset";

export const createSquareWorkflowExecutor = () =>
  createGenericExecutor("square", SquarePosSkillSet, {
    validateStaff: squareValidator,
    validateRewards: squareValidator,
  });
