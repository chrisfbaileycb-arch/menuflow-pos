import type { PosSkillSetDefinition } from "../types";
export const TouchBistroPosSkillSet: PosSkillSetDefinition = {
  provider: "touchbistro", version: "2.0.0", targetEnvironment: "local_agent",
  authRequirements: { type: "bearer_token", credentialFields: ["TOUCHBISTRO_API_TOKEN", "TOUCHBISTRO_VENUE_ID"] },
  supportedWorkflows: ["staff_sync_import", "staff_sync_export", "rewards_sync_import", "rewards_sync_export", "menu_audit_scan", "timecard_pull"],
  skills: [
    { action: "staff_sync_import", name: "ImportTouchBistroStaff", description: "Parses SQLite-synced staff table CSV.", parameters: [{ name: "csvContent", type: "string", description: "TB staff CSV", required: true }], requiredPermissions: ["STAFF_WRITE"] },
    { action: "staff_sync_export", name: "ExportTouchBistroStaff", description: "Exports TouchBistro staff.", parameters: [], requiredPermissions: ["STAFF_READ"] },
    { action: "rewards_sync_import", name: "ImportTouchBistroRewards", description: "Imports TB loyalty accounts.", parameters: [{ name: "csvContent", type: "string", description: "TB loyalty CSV", required: true }], requiredPermissions: ["LOYALTY_WRITE"] },
    { action: "rewards_sync_export", name: "ExportTouchBistroRewards", description: "Exports TB loyalty.", parameters: [], requiredPermissions: ["LOYALTY_READ"] },
    { action: "menu_audit_scan", name: "AuditTouchBistroMenu", description: "Validates low-overhead grid + index pointers.", parameters: [{ name: "csvContent", type: "file_buffer", description: "Menu grid CSV", required: true }], requiredPermissions: ["MENU_READ"] },
    { action: "timecard_pull", name: "PullTouchBistroShifts", description: "Pulls shift ledger.", parameters: [{ name: "startDate", type: "string", description: "ISO date", required: true }], requiredPermissions: ["LABOR_READ"] },
  ],
};
