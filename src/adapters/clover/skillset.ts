import type { PosSkillSetDefinition } from "../types";
export const CloverPosSkillSet: PosSkillSetDefinition = {
  provider: "clover", version: "2.0.0", targetEnvironment: "cloud_api",
  authRequirements: { type: "bearer_token", credentialFields: ["CLOVER_API_TOKEN", "CLOVER_MERCHANT_ID"] },
  supportedWorkflows: ["staff_sync_import", "staff_sync_export", "rewards_sync_import", "rewards_sync_export", "menu_audit_scan"],
  skills: [
    { action: "staff_sync_import", name: "ImportCloverStaff", description: "Multi-tab workbook staff import (ITEMS-adjacent sheet pattern).", parameters: [{ name: "csvContent", type: "file_buffer", description: ".xlsx workbook buffer", required: true }], requiredPermissions: ["EMPLOYEES_WRITE"] },
    { action: "staff_sync_export", name: "ExportCloverStaff", description: "Exports Clover employee roster.", parameters: [], requiredPermissions: ["EMPLOYEES_READ"] },
    { action: "rewards_sync_import", name: "ImportCloverCustomers", description: "Imports Clover customer workbook.", parameters: [{ name: "csvContent", type: "file_buffer", description: ".xlsx buffer", required: true }], requiredPermissions: ["CUSTOMERS_WRITE"] },
    { action: "rewards_sync_export", name: "ExportCloverCustomers", description: "Exports Clover customers.", parameters: [], requiredPermissions: ["CUSTOMERS_READ"] },
    { action: "menu_audit_scan", name: "AuditCloverMenuWorkbook", description: "Validates 3-tab ITEMS/MODIFIER_GROUPS/MODIFIERS relational keys.", parameters: [{ name: "csvContent", type: "file_buffer", description: ".xlsx buffer", required: true }], requiredPermissions: ["INVENTORY_READ"] },
  ],
};
