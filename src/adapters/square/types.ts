export interface SquareRewardMemberExportRecord {
  customerId: string;
  referenceId: string;
  givenName: string;
  familyName: string;
  emailAddress: string;
  phoneNumber: string;
  loyaltyAccountId: string;
  pointsBalance: number;
  tierLevel: string;
}

export interface SquareCouponRedemptionExportRecord {
  transactionId: string;
  sourceLocationId: string;
  createdAt: string;
  appliedDiscountCatalogId: string;
  promotionName: string;
  couponCode: string;
  discountAmountMoney: number;
  grossAmountMoney: number;
}

export interface SquarePayrollExportRecord {
  teamMemberId: string;
  name: string;
  employeeRole: string;
  workDate: string;
  startAtIso: string;
  endAtIso: string;
  paidBreakDurationSec: number;
  unpaidBreakDurationSec: number;
  hoursWorked: number;
  declaredCashTips: number;
}

export interface SquareMenuExportRow {
  token: string;
  name: string;
  variation: string;
  price: number;
  categoryTokens: string;
  modifierSetTokens: string;
  dayPeriodTokens: string;
  servicePointTokens: string;
}
