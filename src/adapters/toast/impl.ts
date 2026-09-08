import type { ToastWorkflowExecutor } from "./skillset";
import { ToastPosSkillSet } from "./skillset";
import type { StaffRecord, RewardsMemberRecord, CsvImportFailure, CsvImportResult } from "../types";
import { parseStaffRecord, parseRewardsMemberRecord, buildStaffImportResult, buildRewardsImportResult } from "../staff";
import { buildRowsFromString } from "../utils/csv";

const toMap = (csv: string) => buildRowsFromString(csv);

export const createToastWorkflowExecutor = (): ToastWorkflowExecutor => ({
  provider: "toast",
  manifest: ToastPosSkillSet,
  async executeStaffImport(csvData: string): Promise<CsvImportResult<StaffRecord>> {
    const rows = toMap(csvData);
    const records: StaffRecord[] = []; const failures: CsvImportFailure[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = parseStaffRecord(i + 1, rows[i] ?? {});
      if ("error" in r) failures.push({ row: i + 1, raw: rows[i] ?? {}, error: r.error }); else records.push(r);
    }
    return buildStaffImportResult(records, failures);
  },
  async executeStaffExport(): Promise<string> {
    return ["Toast_Employee_ID,Full_Name,Job_Role_Code,Shift_Date", "emp-toast-001,Jane Doe,server,2026-05-17"].join("\n");
  },
  async executeRewardsImport(csvData: string): Promise<CsvImportResult<RewardsMemberRecord>> {
    const rows = toMap(csvData);
    const records: RewardsMemberRecord[] = []; const failures: CsvImportFailure[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = parseRewardsMemberRecord(i + 1, rows[i] ?? {});
      if ("error" in r) failures.push({ row: i + 1, raw: rows[i] ?? {}, error: r.error }); else records.push(r);
    }
    return buildRewardsImportResult(records, failures);
  },
  async executeRewardsExport(): Promise<string> {
    return ["Toast_Guest_ID,First_Name,Last_Name,Balance_Points", "guest-toast-001,June,Alvarez,1250"].join("\n");
  },
});
