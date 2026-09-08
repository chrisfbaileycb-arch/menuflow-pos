import type { PosSkillSetDefinition } from "../types";
export const SquarePosSkillSet: PosSkillSetDefinition = {
  provider: "square", version: "2.0.0", targetEnvironment: "cloud_api",
  authRequirements: { type: "oauth2", credentialFields: ["SQUARE_ACCESS_TOKEN", "SQUARE_LOCATION_ID"] },
  supportedWorkflows: ["staff_sync_import", "staff_sync_export", "rewards_sync_import", "rewards_sync_export", "menu_audit_scan", "timecard_pull"],
  skills: [
    { action: "staff_sync_import", name: "ImportSquareTeam", description: "Parses Square Team CSV with token keys.", parameters: [{ name: "csvContent", type: "string", description: "Square team CSV", required: true }], requiredPermissions: ["TEAM_WRITE"] },
    { action: "staff_sync_export", name: "ExportSquareTeam", description: "Exports Square team directory.", parameters: [], requiredPermissions: ["TEAM_READ"] },
    { action: "rewards_sync_import", name: "ImportSquareLoyalty", description: "Imports Square Customer + Loyalty.", parameters: [{ name: "csvContent", type: "string", description: "Square customer CSV", required: true }], requiredPermissions: ["LOYALTY_WRITE"] },
    { action: "rewards_sync_export", name: "ExportSquareLoyalty", description: "Exports Square customer directory.", parameters: [], requiredPermissions: ["LOYALTY_READ"] },
    { action: "menu_audit_scan", name: "AuditSquareCatalog", description: "Validates horizontal itm_/var_/mod_ token CSV.", parameters: [{ name: "csvContent", type: "file_buffer", description: "Square flat-file CSV", required: true }], requiredPermissions: ["CATALOG_READ"] },
    { action: "timecard_pull", name: "PullSquareShifts", description: "Pulls shift ledger with overlap checks.", parameters: [{ name: "startDate", type: "string", description: "ISO date", required: true }], requiredPermissions: ["LABOR_READ"] },
  ],
};
