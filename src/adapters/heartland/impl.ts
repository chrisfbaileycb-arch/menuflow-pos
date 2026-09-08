import type { HeartlandWorkflowExecutor } from "./index";
import type { StaffRecord, RewardsMemberRecord, CsvImportFailure, CsvImportResult } from "../types";
import { parseStaffRecord, parseRewardsMemberRecord, buildStaffImportResult, buildRewardsImportResult } from "../staff";
import { buildRowsFromString } from "../utils/csv";

function csvToMap(csvText: string): Array<Record<string, string>> {
  return buildRowsFromString(csvText);
}

export const createHeartlandWorkflowExecutor = (): HeartlandWorkflowExecutor => ({
  provider: "heartland",

  manifest: {
    provider: "heartland",
    version: "1.2.0",
    targetEnvironment: "hybrid_browser_bridge",
    authRequirements: {
      type: "api_key_secret",
      credentialFields: ["HEARTLAND_SECRET_API_KEY", "HEARTLAND_LOCATION_ID"],
    },
    supportedWorkflows: [
      "staff_sync_import",
      "staff_sync_export",
      "rewards_sync_import",
      "rewards_sync_export",
      "menu_audit_scan",
    ],
    skills: [
      {
        action: "staff_sync_import",
        name: "ImportStaffingCsv",
        description: "Parses standard staffing CSV and syncs employee rosters into Heartland POS records.",
        parameters: [
          { name: "csvContent", type: "string", description: "Raw RFC-4180 CSV string of employees", required: true },
          { name: "overwriteExisting", type: "boolean", description: "Whether to update existing employee IDs or skip", required: false },
        ],
        requiredPermissions: ["EMPLOYEES_WRITE", "POS_ADMIN"],
      },
      {
        action: "staff_sync_export",
        name: "ExportStaffingCsv",
        description: "Pulls current Heartland active employee roster and returns a formatted CSV buffer.",
        parameters: [
          { name: "roleFilter", type: "string", description: "Optional role filter such as server or cook", required: false },
        ],
        requiredPermissions: ["EMPLOYEES_READ"],
      },
      {
        action: "rewards_sync_import",
        name: "ImportRewardsCsv",
        description: "Ingests external loyalty list and maps member tiers to Heartland member profiles.",
        parameters: [
          { name: "csvContent", type: "string", description: "Raw RFC-4180 CSV string of rewards members", required: true },
          {
            name: "mergePointsRule",
            type: "string",
            description: "Strategy: overwrite, sum, or preserve_highest",
            required: true,
          },
        ],
        requiredPermissions: ["LOYALTY_WRITE"],
      },
      {
        action: "rewards_sync_export",
        name: "ExportRewardsCsv",
        description: "Dumps active loyalty members and points balances to CSV format.",
        parameters: [
          {
            name: "minPointsFilter",
            type: "number",
            description: "Minimum points threshold to include",
            required: false,
          },
        ],
        requiredPermissions: ["LOYALTY_READ"],
      },
    ],
  },

  async executeStaffImport(csvData: string): Promise<CsvImportResult<StaffRecord>> {
    const rows = csvToMap(csvData);
    const records: StaffRecord[] = [];
    const failures: CsvImportFailure[] = [];

    for (let index = 0; index < rows.length; index++) {
      const result = parseStaffRecord(index + 1, rows[index] ?? {});
      if ("error" in result) {
        failures.push({ row: index + 1, raw: rows[index] ?? {}, error: result.error });
      } else {
        records.push(result);
      }
    }

    return buildStaffImportResult(records, failures);
  },

  async executeStaffExport(params?: { roleFilter?: string }): Promise<string> {
    if (params) {
      // Future Heartland behavior: filter staff export by roleFilter.
    }
    const header = ["employeeId", "firstName", "lastName", "role", "email", "phone", "hourlyRate", "pinCode", "active"].join(",");
    const blankRows = [
      "demo-employee-001,Sam,Rivera,server,sam@example.com,5550123,22,4433,false",
      "demo-employee-002,Morgan,Chen,cook,morgan@example.com,5550199,26,,true",
    ].join("\n");
    return `${header}\n${blankRows}`;
  },

  async executeRewardsImport(csvData: string, params?: { mergePointsRule?: string }): Promise<CsvImportResult<RewardsMemberRecord>> {
    if (params) {
      // Future Heartland behavior: apply mergePointsRule to incoming points data.
    }
    const rows = csvToMap(csvData);
    const records: RewardsMemberRecord[] = [];
    const failures: CsvImportFailure[] = [];

    for (let index = 0; index < rows.length; index++) {
      const result = parseRewardsMemberRecord(index + 1, rows[index] ?? {});
      if ("error" in result) {
        failures.push({ row: index + 1, raw: rows[index] ?? {}, error: result.error });
      } else {
        records.push(result);
      }
    }

    return buildRewardsImportResult(records, failures);
  },

  async executeRewardsExport(params?: { minPointsFilter?: number }): Promise<string> {
    if (params) {
      // Future Heartland behavior: filter exports by minPointsFilter.
    }
    const header = ["memberId", "firstName", "lastName", "phone", "email", "pointsBalance", "tier", "enrollmentDate", "totalLifetimeSpend"].join(",");
    const blankRows = [
      "mem-001,June,Alvarez,5550123,june@example.com,1250,gold,2024-01-15,4250",
      "mem-002,Peter,Walsh,5550311,peter@example.com,340,bronze,2024-03-02,980",
    ].join("\n");
    return `${header}\n${blankRows}`;
  },
});
