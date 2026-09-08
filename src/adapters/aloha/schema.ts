export type AlohaItemAnchor = number;

export interface AlohaLengthRule {
  key: string;
  minLength: number;
  maxLength: number;
}

export const ALOHA_LENGTH_RULES: ReadonlyArray<AlohaLengthRule> = [
  { key: "item_id", minLength: 1, maxLength: 6 },
  { key: "employee_number", minLength: 1, maxLength: 10 },
  { key: "promo_code", minLength: 1, maxLength: 30 },
  { key: "coupon_code", minLength: 1, maxLength: 30 },
  { key: "service_term_id", minLength: 1, maxLength: 10 },
  { key: "short_name", minLength: 1, maxLength: 30 },
  { key: "email_address", minLength: 1, maxLength: 80 },
];

export function validateAlphanumericLength(value: string, rule: AlohaLengthRule): boolean {
  if (value.length < rule.minLength || value.length > rule.maxLength) return false;
  return /^[A-Za-z0-9][A-Za-z0-9 .\-_]*$/.test(value);
}

export type AlohaEntity =
  | "item"
  | "submenu"
  | "modifier_set"
  | "modifier_item"
  | "daypart_mode"
  | "service_area"
  | "employee"
  | "loyalty"
  | "coupon_usage"
  | "shift";

export interface AlohaItemStructure {
  itemId: AlohaItemAnchor;
  parentSubmenuId: AlohaItemAnchor | null;
  modifierSetIds: ReadonlyArray<AlohaItemAnchor>;
  daypartModes: ReadonlyArray<string>;
}
