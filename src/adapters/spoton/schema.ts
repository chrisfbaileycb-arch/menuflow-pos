export type SpotOnDigitalChannel =
  | "dine_in"
  | "take_out"
  | "delivery"
  | "bar"
  | "room_service";

export type SpotOnServicePoint =
  | "dining_room"
  | "bar"
  | "kitchen"
  | "online"
  | "mobile";

export interface SpotOnMatrixNode {
  itemId: string;
  variationIds: ReadonlyArray<string>;
  roomMapIds: ReadonlyArray<string>;
  daypartIds: ReadonlyArray<string>;
  channelMap: ReadonlyMap<SpotOnDigitalChannel, boolean>;
}

export interface SpotOnMatrixAssociation {
  parentItemId: string;
  childVariationId: string;
  childModifierSetId: string;
  childRoomMapId: string;
  childDaypartId: string;
}

export function normaliseSpotOnId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed;
}

export function enforceLedgerRoute(
  transactionLedgerId: string,
  association: SpotOnMatrixAssociation,
): SpotOnMatrixAssociation & { ledgerId: string } {
  return { ...association, ledgerId: transactionLedgerId };
}
