import type { PosSkillSetDefinition, PosProvider, CsvImportResult, StaffRecord, RewardsMemberRecord } from "../types";

export interface HeartlandSkillParameters {
  csvContent: string;
  overwriteExisting?: boolean;
  roleFilter?: string;
  minPointsFilter?: number;
  mergePointsRule?: "overwrite" | "sum" | "preserve_highest";
}

export type HeartlandWorkflowExecutor = {
  provider: PosProvider;
  manifest: PosSkillSetDefinition;
  executeStaffImport(csvData: string, params?: Pick<HeartlandSkillParameters, "overwriteExisting">): Promise<CsvImportResult<StaffRecord>>;
  executeStaffExport(params?: Pick<HeartlandSkillParameters, "roleFilter">): Promise<string>;
  executeRewardsImport(csvData: string, params?: Pick<HeartlandSkillParameters, "mergePointsRule">): Promise<CsvImportResult<RewardsMemberRecord>>;
  executeRewardsExport(params?: Pick<HeartlandSkillParameters, "minPointsFilter">): Promise<string>;
};

export const HeartlandPosSkillSet: PosSkillSetDefinition = {
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
      description:
        "Parses standard staffing CSV and syncs employee rosters into Heartland POS records.",
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
};
