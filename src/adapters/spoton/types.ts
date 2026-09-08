export interface SpotOnRewardExportRecord {
  userId: string;
  firstName: string;
  lastName: string;
  mobilePhone: string;
  email: string;
  pointsBalance: number;
  lifetimeVisits: number;
}

export interface SpotOnCouponExportRecord {
  ticketId: string;
  stationId: string;
  timestamp: string;
  promotionId: string;
  codeString: string;
  calculatedDiscount: number;
  ticketTotal: number;
}

export interface SpotOnPayrollExportRecord {
  empId: string;
  fullName: string;
  department: string;
  shiftDate: string;
  inIso: string;
  outIso: string;
  actualHours: number;
  ccTipPayout: number;
}

export interface SpotOnDaypartDefinition {
  daypartId: string;
  label: string;
  validFrom: string;
  validTo: string;
}

export interface SpotOnRoomMapDefinition {
  roomMapId: string;
  name: string;
  servicePoint: string;
  channelVisibility: ReadonlyMap<SpotOnDigitalChannel, boolean>;
}

import type { SpotOnDigitalChannel, SpotOnMatrixNode } from "./schema";

export interface SpotOnMenuMatrixItem {
  itemId: string;
  name: string;
  price: number;
  categoryId: string;
  roomMapIds: ReadonlyArray<string>;
  daypartIds: ReadonlyArray<string>;
  variationNodes: ReadonlyArray<SpotOnMatrixNode>;
  modifierSetIds: ReadonlyArray<string>;
}
