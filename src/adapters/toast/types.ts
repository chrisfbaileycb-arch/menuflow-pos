export interface ToastRewardMemberExportRecord {
  guestId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  lifetimePoints: number;
  availableBalancePoints: number;
  enrolledDate: string;
  statusActive: boolean;
}

export interface ToastCouponRedemptionExportRecord {
  checkNumber: string;
  orderId: string;
  closedTimestamp: string;
  discountServiceId: string;
  couponCode: string;
  appliedDiscountValue: number;
  netSales: number;
}

export interface ToastPayrollExportRecord {
  employeeId: string;
  fullName: string;
  jobRoleCode: string;
  shiftDate: string;
  clockInUtc: string;
  clockOutUtc: string;
  breakTimeMinutes: number;
  regularHours: number;
  overtimeHours: number;
  totalTipsCollected: number;
}

export type ToastMenuCommandOperation =
  | "CREATE"
  | "UPDATE"
  | "ATTACH";

export type ToastMenuCommandEntity =
  | "MENU_ITEM"
  | "MODIFIER_GROUP"
  | "MODIFIER"
  | "DAY_PART"
  | "ROOM"
  | "SERVICE_AREA"
  | "OPERATION_GROUP";

export interface ToastMenuCommandRow {
  opId: string;
  operation: ToastMenuCommandOperation;
  entity: ToastMenuCommandEntity;
  name: string;
  price: number;
  parent: string | null;
  dayPart: string | null;
  targetRoom: string | null;
}
