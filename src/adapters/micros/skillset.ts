import type { PosSkillSetDefinition } from "../types";
export const MicrosPosSkillSet: PosSkillSetDefinition = {
  provider: "micros", version: "2.0.0", targetEnvironment: "cloud_api",
  authRequirements: { type: "oauth2", credentialFields: ["MICROS_API_KEY", "MICROS_ENTERPRISE_ID"] },
  supportedWorkflows: ["staff_sync_import", "staff_sync_export", "rewards_sync_import", "rewards_sync_export", "menu_audit_scan", "timecard_pull"],
  skills: [
    { action: "staff_sync_import", name: "ImportMicrosStaff", description: "Parses MICROS staff with Obj_Num / Job_Seq.", parameters: [{ name: "csvContent", type: "string", description: "MICROS staff CSV", required: true }], requiredPermissions: ["LABOR_WRITE"] },
    { action: "staff_sync_export", name: "ExportMicrosStaff", description: "Exports MICROS staff.", parameters: [], requiredPermissions: ["LABOR_READ"] },
    { action: "rewards_sync_import", name: "ImportMicrosGuests", description: "Imports MICROS guest GUID ledger.", parameters: [{ name: "csvContent", type: "string", description: "MICROS guest CSV", required: true }], requiredPermissions: ["GUEST_WRITE"] },
    { action: "rewards_sync_export", name: "ExportMicrosGuests", description: "Exports MICROS guests.", parameters: [], requiredPermissions: ["GUEST_READ"] },
    { action: "menu_audit_scan", name: "AuditMicrosMenu", description: "Validates RVC + Daypart Schedule hierarchy.", parameters: [{ name: "csvContent", type: "file_buffer", description: "MICROS menu CSV", required: true }], requiredPermissions: ["MENU_READ"] },
    { action: "timecard_pull", name: "PullMicrosPunches", description: "Pulls punch ledger.", parameters: [{ name: "startDate", type: "string", description: "ISO date", required: true }], requiredPermissions: ["LABOR_READ"] },
  ],
};
