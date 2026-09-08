import { AlohaPosSkillSet } from "./skillset";
import type { StaffRecord, RewardsMemberRecord, CsvImportFailure, CsvImportResult } from "../types";
import { parseStaffRecord, parseRewardsMemberRecord, buildStaffImportResult, buildRewardsImportResult } from "../staff";
import { buildRowsFromString } from "../utils/csv";
const toMap = (c: string) => buildRowsFromString(c);
export const createAlohaWorkflowExecutor = () => ({
  provider: "aloha" as const, manifest: AlohaPosSkillSet,
  async executeStaffImport(csvData: string): Promise<CsvImportResult<StaffRecord>> {
    const rows = toMap(csvData); const r: StaffRecord[] = []; const f: CsvImportFailure[] = [];
    for (let i = 0; i < rows.length; i++) { const res = parseStaffRecord(i + 1, rows[i] ?? {}); if ("error" in res) f.push({ row: i + 1, raw: rows[i] ?? {}, error: res.error }); else r.push(res); }
    return buildStaffImportResult(r, f);
  },
  async executeStaffExport(): Promise<string> { return "Aloha_Emp_Num,Last_Name,First_Name,Job_ID\n001,Rivera,Sam,server"; },
  async executeRewardsImport(csvData: string): Promise<CsvImportResult<RewardsMemberRecord>> {
    const rows = toMap(csvData); const r: RewardsMemberRecord[] = []; const f: CsvImportFailure[] = [];
    for (let i = 0; i < rows.length; i++) { const res = parseRewardsMemberRecord(i + 1, rows[i] ?? {}); if ("error" in res) f.push({ row: i + 1, raw: rows[i] ?? {}, error: res.error }); else r.push(res); }
    return buildRewardsImportResult(r, f);
  },
  async executeRewardsExport(): Promise<string> { return "Aloha_Loyalty_ID,Custom_First,Current_Balance\nloyal-001,June,1250"; },
});
