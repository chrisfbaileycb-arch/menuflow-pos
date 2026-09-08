import { createGenericExecutor } from "../base/createGenericExecutor";
import { toastValidator } from "../base/validators";
import { ToastPosSkillSet } from "./skillset";

export const createToastWorkflowExecutor = () =>
  createGenericExecutor("toast", ToastPosSkillSet, {
    validateStaff: toastValidator,
    validateRewards: toastValidator,
  });
