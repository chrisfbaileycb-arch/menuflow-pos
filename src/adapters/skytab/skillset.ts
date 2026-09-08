import type { PosSkillSetDefinition } from "../types";
export const SkyTabPosSkillSet: PosSkillSetDefinition = {
  provider: "skytab", version: "2.0.0", targetEnvironment: "hybrid_browser_bridge",
  authRequirements: { type: "api_key_secret", credentialFields: ["SKYTAB_API_KEY", "SKYTAB_MERCHANT_ID"] },
  supportedWorkflows: ["staff_sync_import", "staff_sync_export", "rewards_sync_import", "rewards_sync_export", "menu_audit_scan", "timecard_pull"],
  skills: [
    { action: "staff_sync_import", name: "ImportSkyTabStaff", description: "Parses SkyTab staff with job codes.", parameters: [{ name: "csvContent", type: "string", description: "SkyTab staff CSV", required: true }], requiredPermissions: ["STAFF_WRITE"] },
    { action: "staff_sync_export", name: "ExportSkyTabStaff", description: "Exports SkyTab staff.", parameters: [], requiredPermissions: ["STAFF_READ"] },
    { action: "rewards_sync_import", name: "ImportSkyTabMembers", description: "Imports SkyTab loyalty members.", parameters: [{ name: "csvContent", type: "string", description: "SkyTab member CSV", required: true }], requiredPermissions: ["LOYALTY_WRITE"] },
    { action: "rewards_sync_export", name: "ExportSkyTabMembers", description: "Exports SkyTab members.", parameters: [], requiredPermissions: ["LOYALTY_READ"] },
    { action: "menu_audit_scan", name: "AuditSkyTabMenu", description: "Validates terminal-category + daypart matrix.", parameters: [{ name: "csvContent", type: "file_buffer", description: "Menu CSV", required: true }], requiredPermissions: ["MENU_READ"] },
    { action: "timecard_pull", name: "PullSkyTabShifts", description: "Pulls shift ledger.", parameters: [{ name: "startDate", type: "string", description: "ISO date", required: true }], requiredPermissions: ["LABOR_READ"] },
  ],
};
