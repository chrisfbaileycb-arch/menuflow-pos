import type { PosSkillSetDefinition, PosProvider, CsvImportResult, StaffRecord, RewardsMemberRecord } from "../types";

export type ToastWorkflowExecutor = {
  provider: PosProvider;
  manifest: PosSkillSetDefinition;
  executeStaffImport(csvData: string): Promise<CsvImportResult<StaffRecord>>;
  executeStaffExport(): Promise<string>;
  executeRewardsImport(csvData: string): Promise<CsvImportResult<RewardsMemberRecord>>;
  executeRewardsExport(): Promise<string>;
};

export const ToastPosSkillSet: PosSkillSetDefinition = {
  provider: "toast",
  version: "2.0.0",
  targetEnvironment: "cloud_api",
  authRequirements: { type: "oauth2", credentialFields: ["TOAST_API_KEY", "TOAST_LOCATION_GUID"] },
  supportedWorkflows: ["staff_sync_import", "staff_sync_export", "rewards_sync_import", "rewards_sync_export", "menu_audit_scan", "timecard_pull"],
  skills: [
    { action: "staff_sync_import", name: "ImportToastStaff", description: "Parses Toast labor CSV and syncs employee records via sequential GUID validation.", parameters: [{ name: "csvContent", type: "string", description: "RFC-4180 CSV with Toast_Employee_ID", required: true }], requiredPermissions: ["LABOR_WRITE"] },
    { action: "staff_sync_export", name: "ExportToastStaff", description: "Exports Toast labor roster.", parameters: [], requiredPermissions: ["LABOR_READ"] },
    { action: "rewards_sync_import", name: "ImportToastRewards", description: "Imports loyalty members matching Toast Loyalty API schema.", parameters: [{ name: "csvContent", type: "string", description: "RFC-4180 CSV with Toast_Guest_ID", required: true }], requiredPermissions: ["LOYALTY_WRITE"] },
    { action: "rewards_sync_export", name: "ExportToastRewards", description: "Exports loyalty guest ledger.", parameters: [], requiredPermissions: ["LOYALTY_READ"] },
    { action: "menu_audit_scan", name: "AuditToastMenu", description: "Validates vertical multi-row menu command sequence (CREATE/UPDATE/ATTACH).", parameters: [{ name: "csvContent", type: "file_buffer", description: "Toast sequential CSV", required: true }], requiredPermissions: ["MENU_READ"] },
    { action: "timecard_pull", name: "PullToastTimecards", description: "Pulls timecard ledger with sequential dependency checks.", parameters: [{ name: "startDate", type: "string", description: "ISO date", required: true }], requiredPermissions: ["LABOR_READ"] },
  ],
};
