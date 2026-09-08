import type { PosSkillSetDefinition } from "../types";
export const RevelPosSkillSet: PosSkillSetDefinition = {
  provider: "revel", version: "2.0.0", targetEnvironment: "cloud_api",
  authRequirements: { type: "bearer_token", credentialFields: ["REVEL_API_KEY", "REVEL_ESTABLISHMENT_ID"] },
  supportedWorkflows: ["staff_sync_import", "staff_sync_export", "rewards_sync_import", "rewards_sync_export", "menu_audit_scan", "timecard_pull"],
  skills: [
    { action: "staff_sync_import", name: "ImportRevelStaff", description: "Parses Revel staff CSV.", parameters: [{ name: "csvContent", type: "string", description: "Revel staff CSV", required: true }], requiredPermissions: ["STAFF_WRITE"] },
    { action: "staff_sync_export", name: "ExportRevelStaff", description: "Exports Revel staff.", parameters: [], requiredPermissions: ["STAFF_READ"] },
    { action: "rewards_sync_import", name: "ImportRevelCustomers", description: "Imports Revel customer ledger.", parameters: [{ name: "csvContent", type: "string", description: "Revel customer CSV", required: true }], requiredPermissions: ["CUSTOMERS_WRITE"] },
    { action: "rewards_sync_export", name: "ExportRevelCustomers", description: "Exports Revel customers.", parameters: [], requiredPermissions: ["CUSTOMERS_READ"] },
    { action: "menu_audit_scan", name: "AuditRevelMenu", description: "Validates multi-tier parent + delivery override tokens.", parameters: [{ name: "csvContent", type: "file_buffer", description: "Revel menu CSV", required: true }], requiredPermissions: ["MENU_READ"] },
    { action: "timecard_pull", name: "PullRevelTimecards", description: "Pulls Revel timecards.", parameters: [{ name: "startDate", type: "string", description: "ISO date", required: true }], requiredPermissions: ["LABOR_READ"] },
  ],
};
