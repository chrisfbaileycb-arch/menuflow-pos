import { createGenericExecutor } from "../base/createGenericExecutor";
import { LightspeedPosSkillSet } from "./skillset";

export const createLightspeedWorkflowExecutor = () =>
  createGenericExecutor("lightspeed", LightspeedPosSkillSet);
