import { createGenericExecutor } from "../base/createGenericExecutor";
import { CloverPosSkillSet } from "./skillset";

// Clover: CSV-only. Multi-tab workbooks must be pre-split to items.csv / modifiers.csv upstream.
// No exceljs — use browser CSV export path via automation/browser_agent.py.
export const createCloverWorkflowExecutor = () => createGenericExecutor("clover", CloverPosSkillSet);
