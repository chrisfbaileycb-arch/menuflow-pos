export interface AlohaRewardExportRecord {
  loyaltyId: string;
  altPhone: string;
  customFirst: string;
  customLast: string;
  emailAddr: string;
  currentBalance: number;
  lifetimeTier: string;
}

export interface AlohaCouponExportRecord {
  checkId: string;
  termId: string;
  closeBusDate: string;
  compId: string;
  promoCode: string;
  discountDeduction: number;
  grossSales: number;
}

export interface AlohaPayrollExportRecord {
  employeeNumber: string;
  lastName: string;
  firstName: string;
  jobId: string;
  shiftNumber: number;
  clockInTime: string;
  clockOutTime: string;
  declaredCashTips: number;
}

export type AlohaDaypartMode = "Dayparts" | "A La Carte" | "All_Day";

export interface AlohaMenuMatrixRow {
  itemId: number;
  itemName: string;
  parentSubmenuId: number | null;
  price: number;
  daypartMode: AlohaDaypartMode;
  serviceAreaCode: string;
  modifierSetIds: ReadonlyArray<number>;
}
