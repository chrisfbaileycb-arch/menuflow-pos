export type SquareToken =
  | "itm_"
  | "var_"
  | "mod_"
  | "cust_"
  | "discount_"
  | "team_"
  | "location_"
  | "loyalty_";

export interface SquareTokenMap {
  item?: string;
  variation?: string;
  modifierSet?: string;
  customer?: string;
  discount?: string;
  teamMember?: string;
  location?: string;
  loyaltyAccount?: string;
}

export function parseDelimitedBlock(value: string): string[] {
  if (!value) return [];
  return value.split("|").map((part) => part.trim()).filter((part) => part.length > 0);
}

export function toUpperCaseTokens(value: string): string[] {
  return parseDelimitedBlock(value.toUpperCase());
}
