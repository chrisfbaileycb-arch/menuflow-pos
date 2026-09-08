import type { PosProvider, PosSkillSetDefinition, CsvImportResult, StaffRecord, RewardsMemberRecord, CsvImportFailure } from "../types";
import { parseStaffRecord, parseRewardsMemberRecord, buildStaffImportResult, buildRewardsImportResult } from "../staff";
import { buildRowsFromString } from "../utils/csv";

export type PosValidatorHook = (record: Record<string, string>) => { valid: boolean; error?: string };

export interface IPosWorkflowExecutor {
  manifest: PosSkillSetDefinition;
  executeStaffImport(csvData: string): Promise<CsvImportResult<StaffRecord>>;
  executeStaffExport(): Promise<string>;
  executeRewardsImport(csvData: string): Promise<CsvImportResult<RewardsMemberRecord>>;
  executeRewardsExport(): Promise<string>;
  executeTimecardPull(startDate: string, endDate: string): Promise<string>;
}

export function createGenericExecutor(
  provider: PosProvider,
  manifest: PosSkillSetDefinition,
  customValidators?: {
    validateStaff?: PosValidatorHook;
    validateRewards?: PosValidatorHook;
  },
): IPosWorkflowExecutor {
  return {
    manifest,
    async executeStaffImport(csvData: string): Promise<CsvImportResult<StaffRecord>> {
      const rows = buildRowsFromString(csvData);
      const records: StaffRecord[] = [];
      const failures: CsvImportFailure[] = [];
      for (let i = 0; i < rows.length; i++) {
        const raw = rows[i] ?? {};
        if (customValidators?.validateStaff) {
          const v = customValidators.validateStaff(raw);
          if (!v.valid) { failures.push({ row: i + 1, raw, error: v.error ?? "Staff validation failed." }); continue; }
        }
        const res = parseStaffRecord(i + 1, raw);
        if ("error" in res) failures.push({ row: i + 1, raw, error: res.error }); else records.push(res);
      }
      return buildStaffImportResult(records, failures);
    },
    async executeStaffExport(): Promise<string> {
      throw new Error(`[${provider}] Cloud export requires live credentials or browser runner execution. Use automation/browser_agent.py for back-office extraction.`);
    },
    async executeRewardsImport(csvData: string): Promise<CsvImportResult<RewardsMemberRecord>> {
      const rows = buildRowsFromString(csvData);
      const records: RewardsMemberRecord[] = [];
      const failures: CsvImportFailure[] = [];
      for (let i = 0; i < rows.length; i++) {
        const raw = rows[i] ?? {};
        if (customValidators?.validateRewards) {
          const v = customValidators.validateRewards(raw);
          if (!v.valid) { failures.push({ row: i + 1, raw, error: v.error ?? "Rewards validation failed." }); continue; }
        }
        const res = parseRewardsMemberRecord(i + 1, raw);
        if ("error" in res) failures.push({ row: i + 1, raw, error: res.error }); else records.push(res);
      }
      return buildRewardsImportResult(records, failures);
    },
    async executeRewardsExport(): Promise<string> {
      throw new Error(`[${provider}] Cloud export requires live credentials or browser runner execution. Use automation/browser_agent.py for back-office extraction.`);
    },
    async executeTimecardPull(startDate: string, endDate: string): Promise<string> {
      if (!startDate || !endDate) throw new Error("executeTimecardPull requires startDate and endDate (ISO strings).");
      throw new Error(`[${provider}] Timecard pull requires live credentials or browser runner execution. Requested range ${startDate} → ${endDate}.`);
    },
  };
}
