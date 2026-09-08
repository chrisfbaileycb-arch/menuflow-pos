import type { PosValidatorHook } from "./createGenericExecutor";

// Square: token prefix check — if a catalog token column is present, enforce itm_/var_/mod_
// Pass-through when no token column present (staff/rewards rows don't carry them)
export const squareValidator: PosValidatorHook = (raw) => {
  const tokenKeys = ["token", "catalog_token", "object_id", "item_token"];
  for (const k of tokenKeys) {
    const v = raw[k];
    if (v && v.trim().length > 0) {
      if (!/^(itm_|var_|mod_|cust_|discount_|team_|location_|loyalty_)/.test(v.trim())) {
        return { valid: false, error: `Square: token "${v}" must start with itm_, var_, mod_, etc.` };
      }
    }
  }
  return { valid: true };
};

// Toast: GUID / Op_ID sequence integrity — check GUID-looking fields are alphanumeric+dash, length >=8
export const toastValidator: PosValidatorHook = (raw) => {
  const guidKeys = ["guid", "version_id", "op_id", "parent_op_id", "toast_guest_id", "toast_employee_id", "order_id"];
  for (const k of guidKeys) {
    const v = raw[k];
    if (v && v.trim().length > 0) {
      if (v.trim().length < 8 || !/^[a-zA-Z0-9-]+$/.test(v.trim())) {
        return { valid: false, error: `Toast: field ${k}="${v}" is not a valid GUID/Op_ID.` };
      }
    }
  }
  // If both op_id and parent present, they must not be identical
  if (raw["op_id"] && raw["parent_op_id"] && raw["op_id"].trim() === raw["parent_op_id"].trim()) {
    return { valid: false, error: "Toast: Op_ID cannot equal parent Op_ID (circular parent)." };
  }
  return { valid: true };
};

// Aloha: strict alphanumeric length caps — flat-file truncates silently
const ALOHA_CAPS: Record<string, number> = {
  employee_id: 10, employeeid: 10, aloha_emp_num: 10,
  first_name: 30, last_name: 30, custom_first: 30, custom_last: 30,
  email: 80, email_addr: 80,
  promo_code: 30, coupon_code: 30,
};
export const alohaValidator: PosValidatorHook = (raw) => {
  for (const [k, cap] of Object.entries(ALOHA_CAPS)) {
    const v = raw[k];
    if (v && v.length > cap) return { valid: false, error: `Aloha: field ${k} exceeds ${cap} chars (flat-file will truncate).` };
  }
  return { valid: true };
};

// SpotOn / SkyTab: ledger/terminal presence — every row must carry transaction anchor
export const spotonValidator: PosValidatorHook = (raw) => {
  // Only enforce when ticket/transaction columns are present (menu/payroll rows); skip pure staff/rewards imports
  const hasTicketContext = raw["ticket_id"] !== undefined || raw["transaction_id"] !== undefined || raw["station_id"] !== undefined;
  if (!hasTicketContext) return { valid: true };
  const ledgerKeys = ["ticket_id", "transaction_id", "station_id", "terminal_id", "check_uuid"];
  const hasLedger = ledgerKeys.some((k) => raw[k]?.trim().length);
  if (!hasLedger) return { valid: false, error: "SpotOn/SkyTab: row missing transaction ledger anchor (Ticket_ID / Terminal_ID)." };
  return { valid: true };
};

export const validators = {
  square: squareValidator,
  toast: toastValidator,
  aloha: alohaValidator,
  spoton: spotonValidator,
  skytab: spotonValidator, // same ledger rule
};
