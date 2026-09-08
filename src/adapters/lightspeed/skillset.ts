import type { PosSkillSetDefinition } from "../types";
export const LightspeedPosSkillSet: PosSkillSetDefinition = {
  provider: "lightspeed", version: "2.0.0", targetEnvironment: "cloud_api",
  authRequirements: { type: "oauth2", credentialFields: ["LIGHTSPEED_API_KEY", "LIGHTSPEED_ACCOUNT_ID"] },
  supportedWorkflows: ["staff_sync_import", "staff_sync_export", "rewards_sync_import", "rewards_sync_export", "menu_audit_scan", "timecard_pull"],
  skills: [
    { action: "staff_sync_import", name: "ImportLightspeedStaff", description: "Parses Lightspeed staff with operational roles.", parameters: [{ name: "csvContent", type: "string", description: "LS staff CSV", required: true }], requiredPermissions: ["STAFF_WRITE"] },
    { action: "staff_sync_export", name: "ExportLightspeedStaff", description: "Exports Lightspeed staff.", parameters: [], requiredPermissions: ["STAFF_READ"] },
    { action: "rewards_sync_import", name: "ImportLightspeedCustomers", description: "Imports LS customer loyalty.", parameters: [{ name: "csvContent", type: "string", description: "LS customer CSV", required: true }], requiredPermissions: ["CUSTOMERS_WRITE"] },
    { action: "rewards_sync_export", name: "ExportLightspeedCustomers", description: "Exports LS customers.", parameters: [], requiredPermissions: ["CUSTOMERS_READ"] },
    { action: "menu_audit_scan", name: "AuditLightspeedMenu", description: "Validates ingredient-level JSON tree + inventory links.", parameters: [{ name: "csvContent", type: "file_buffer", description: "LS menu JSON", required: true }], requiredPermissions: ["CATALOG_READ"] },
    { action: "timecard_pull", name: "PullLightspeedShifts", description: "Pulls shift ledger.", parameters: [{ name: "startDate", type: "string", description: "ISO date", required: true }], requiredPermissions: ["LABOR_READ"] },
  ],
};
