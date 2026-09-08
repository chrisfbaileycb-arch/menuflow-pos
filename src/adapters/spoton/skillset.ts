import type { PosSkillSetDefinition } from "../types";
export const SpotOnPosSkillSet: PosSkillSetDefinition = {
  provider: "spoton", version: "2.0.0", targetEnvironment: "hybrid_browser_bridge",
  authRequirements: { type: "api_key_secret", credentialFields: ["SPOTON_API_KEY", "SPOTON_LOCATION_ID"] },
  supportedWorkflows: ["staff_sync_import", "staff_sync_export", "rewards_sync_import", "rewards_sync_export", "menu_audit_scan", "timecard_pull"],
  skills: [
    { action: "staff_sync_import", name: "ImportSpotOnStaff", description: "Parses SpotOn labor CSV routed through ledger.", parameters: [{ name: "csvContent", type: "string", description: "SpotOn staff CSV", required: true }], requiredPermissions: ["LABOR_WRITE"] },
    { action: "staff_sync_export", name: "ExportSpotOnStaff", description: "Exports SpotOn staff.", parameters: [], requiredPermissions: ["LABOR_READ"] },
    { action: "rewards_sync_import", name: "ImportSpotOnRewards", description: "Imports SpotOn loyalty.", parameters: [{ name: "csvContent", type: "string", description: "SpotOn loyalty CSV", required: true }], requiredPermissions: ["LOYALTY_WRITE"] },
    { action: "rewards_sync_export", name: "ExportSpotOnRewards", description: "Exports SpotOn loyalty.", parameters: [], requiredPermissions: ["LOYALTY_READ"] },
    { action: "menu_audit_scan", name: "AuditSpotOnCatalog", description: "Validates nested JSON catalog matrices (Room Maps + Dayparts).", parameters: [{ name: "csvContent", type: "file_buffer", description: "JSON catalog payload", required: true }], requiredPermissions: ["MENU_READ"] },
    { action: "timecard_pull", name: "PullSpotOnShifts", description: "Pulls SpotOn shift ledger.", parameters: [{ name: "startDate", type: "string", description: "ISO date", required: true }], requiredPermissions: ["LABOR_READ"] },
  ],
};
