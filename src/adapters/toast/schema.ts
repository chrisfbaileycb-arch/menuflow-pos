export type ToastVersionId = string;

export type ToastEntity =
  | "menu_item"
  | "modifier_group"
  | "modifier"
  | "day_part"
  | "room"
  | "service_area"
  | "operation_group";

export type ToastOperation = "CREATE" | "UPDATE" | "ATTACH";

export interface ToastEntityReference {
  versionId: ToastVersionId;
  entity: ToastEntity;
  parentVersionId?: ToastVersionId;
}

export interface ToastRecordValidation {
  valid: boolean;
  reason?: string;
}

export function validateToastVersionId(value: unknown): value is ToastVersionId {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length < 8) return false;
  return /^[a-zA-Z0-9-]+$/.test(trimmed);
}

export function validateParentDeclared(
  versionId: ToastVersionId,
  parentVersionId: string | undefined,
  declaredParents: ReadonlySet<ToastVersionId>,
): boolean {
  if (versionId === parentVersionId) return false;
  if (parentVersionId && !declaredParents.has(parentVersionId)) return false;
  return true;
}
