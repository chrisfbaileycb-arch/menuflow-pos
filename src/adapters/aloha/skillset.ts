import type { PosSkillSetDefinition } from "../types";
export const AlohaPosSkillSet: PosSkillSetDefinition = {
  provider: "aloha", version: "2.0.0", targetEnvironment: "local_agent",
  authRequirements: { type: "session_cookie", credentialFields: ["ALOHA_USERNAME", "ALOHA_PASSWORD", "ALOHA_STORE_ID"] },
  supportedWorkflows: ["staff_sync_import", "staff_sync_export", "rewards_sync_import", "rewards_sync_export", "menu_audit_scan", "timecard_pull"],
  skills: [
    { action: "staff_sync_import", name: "ImportAlohaStaff", description: "Validates fixed-width DBF/XML staff with strict ID length.", parameters: [{ name: "csvContent", type: "string", description: "Aloha staff CSV", required: true }], requiredPermissions: ["EMPLOYEES_WRITE"] },
    { action: "staff_sync_export", name: "ExportAlohaStaff", description: "Exports Aloha employee roster.", parameters: [], requiredPermissions: ["EMPLOYEES_READ"] },
    { action: "rewards_sync_import", name: "ImportAlohaLoyalty", description: "Imports Aloha loyalty with Alt_Phone dedup.", parameters: [{ name: "csvContent", type: "string", description: "Aloha loyalty CSV", required: true }], requiredPermissions: ["LOYALTY_WRITE"] },
    { action: "rewards_sync_export", name: "ExportAlohaLoyalty", description: "Exports Aloha loyalty ledger.", parameters: [], requiredPermissions: ["LOYALTY_READ"] },
    { action: "menu_audit_scan", name: "AuditAlohaMenu", description: "Validates item ID integers + modifier set pointers.", parameters: [{ name: "csvContent", type: "file_buffer", description: "DBF/XML buffer", required: true }], requiredPermissions: ["MENU_READ"] },
    { action: "timecard_pull", name: "PullAlohaShifts", description: "Pulls Aloha shift ledger.", parameters: [{ name: "startDate", type: "string", description: "ISO date", required: true }], requiredPermissions: ["LABOR_READ"] },
  ],
};
