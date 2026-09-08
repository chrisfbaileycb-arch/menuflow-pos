import type { PosProvider, PosWorkflowAction, CsvImportResult } from "./types";

export interface PosTransformationContract {
  provider: PosProvider;
  supportedActions: PosWorkflowAction[];
  normalizeRecord(record: Record<string, string>): NormalizedPosRecord | null;
  validateImportPayload(records: NormalizedPosRecord[]): ValidationResult;
  buildImportResult(records: NormalizedPosRecord[], errors: ValidationIssue[]): CsvImportResult<NormalizedPosRecord>;
  exportFieldOrder: string[];
}

export interface NormalizedPosRecord {
  provider: PosProvider;
  action: PosWorkflowAction;
  fields: Record<string, string | number | boolean | null>;
  opId?: string;
  parentOpId?: string;
  entityType?: string;
  warnings: string[];
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

export interface ValidationIssue {
  rowIndex: number;
  rowIdentifier?: string;
  code: string;
  message: string;
}

export type ExportFieldSpec = {
  name: string;
  required: boolean;
  type: "string" | "number" | "boolean" | "date" | "enum";
  mapping: string;
};

export interface PosAdapterManifest {
  provider: PosProvider;
  label: string;
  description: string;
  contract: PosTransformationContract;
  authModel: {
    credentialType: string;
    credentialFields: string[];
  };
  notes: string[];
}

export function isPosAdapterManifest(value: unknown): value is PosAdapterManifest {
  if (typeof value !== "object" || value === null) return false;
  const object = value as Record<string, unknown>;
  return typeof object.provider === "string" && Array.isArray(object.notes);
}
