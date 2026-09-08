import { createGenericExecutor } from "../base/createGenericExecutor";
import { HeartlandPosSkillSet } from "./index";

export const createHeartlandWorkflowExecutor = () =>
  createGenericExecutor("heartland", HeartlandPosSkillSet);
