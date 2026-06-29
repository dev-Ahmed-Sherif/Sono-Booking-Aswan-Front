import {

  isUnitFreeFromInquiryStart,

  maxYmd,

} from "@/lib/availability-dates";

import type { UnitBlockingEndIndex } from "@/lib/availability-occupancy";

import type {

  AvailabilityUnitCard,

  ReservationStoredUnitSnapshot,

} from "@/lib/availability-inquiry";

import {
  HOUSING_REQUEST_CATAGORY_EXTENSION,
  parseAllocationTypeEnum,
  type AddRequestDtoPayload,
} from "@/lib/housing-request-map";



export type ExtendStayCompanionRow = {

  id: string;

  name: string;

};



export type ExtendStayContext = {

  sourceRequestId: string;

  /** `Request.RequestToId` from the stay being extended. */
  requestToId: string;

  reservationId: string;

  /** Current reservation checkout (yyyy-MM-dd) for extend validation fallback. */

  reservationEndYmd: string;

  unitSnapshots: ReservationStoredUnitSnapshot[];

  companions: ExtendStayCompanionRow[];

};



export function reservationUnitMatchKey(

  unitKind: string,

  id: string,

): string {

  return `${unitKind}:${id.trim().toLowerCase()}`;

}



function blockingEndForStoredUnit(

  unit: ReservationStoredUnitSnapshot,

  index: UnitBlockingEndIndex | null,

): string | undefined {

  if (!index) return undefined;

  const id = unit.id.trim().toLowerCase();

  if (unit.unitKind === "bed") {

    return maxYmd(

      index.beds.get(id),

      unit.roomId ? index.rooms.get(unit.roomId.trim().toLowerCase()) : undefined,

      unit.apartmentId

        ? index.apartments.get(unit.apartmentId.trim().toLowerCase())

        : undefined,

    );

  }

  if (unit.unitKind === "room") {

    return maxYmd(

      index.rooms.get(id),

      unit.apartmentId

        ? index.apartments.get(unit.apartmentId.trim().toLowerCase())

        : undefined,

    );

  }

  return index.apartments.get(id);

}



/** Extend uses booking occupancy (noon rule), not the Available-only catalog list. */

export function areReservationUnitsFreeForExtend(input: {

  units: ReservationStoredUnitSnapshot[];

  inquiryStartYmd: string;

  reservationEndYmd?: string;

  occupancyIndex?: UnitBlockingEndIndex | null;

}): boolean {

  const inquiry = input.inquiryStartYmd.trim().slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(inquiry) || input.units.length === 0) {

    return false;

  }



  const reservationEnd = input.reservationEndYmd?.trim().slice(0, 10);



  for (const unit of input.units) {

    const bookingEnd =

      blockingEndForStoredUnit(unit, input.occupancyIndex ?? null) ??

      reservationEnd;

    if (!bookingEnd || !isUnitFreeFromInquiryStart(inquiry, bookingEnd)) {

      return false;

    }

  }

  return true;

}



export function unitSnapshotsToAvailabilityCards(

  units: ReservationStoredUnitSnapshot[],

): AvailabilityUnitCard[] {

  return units.map((u) => ({

    id: u.id,

    unitKind: u.unitKind,

    title: u.title,

    subtitle: u.subtitle,

    ...(u.apartmentId ? { apartmentId: u.apartmentId } : {}),

    ...(u.roomId ? { roomId: u.roomId } : {}),

    ...(u.priceLabel ? { priceLabel: u.priceLabel } : {}),

    ...(u.genderType ? { genderType: u.genderType } : {}),
    ...(u.parentRoomLabel ? { parentRoomLabel: u.parentRoomLabel } : {}),
    ...(u.parentApartmentLabel
      ? { parentApartmentLabel: u.parentApartmentLabel }
      : {}),
    ...(u.buildingNumberAr ? { buildingNumberAr: u.buildingNumberAr } : {}),
    ...(u.city ? { city: u.city } : {}),

  }));

}



/**
 * Maps extend review form to `AddRequestDto` for `Requests/add`.
 * Extension adds only send changed scalars + `PreviousRequestId`; units, companions,
 * and attachments are resolved on the backend from the previous request.
 */
export function mapExtendStayToAddRequestDto(input: {
  /** Request id from the completed reservation being extended. */
  previousRequestId: string;
  startDateYmd: string;
  nights: number;
  requestTypeId: string;
  allocationTypeValue: string;
  requestToId: string;
}):
  | { ok: true; dto: AddRequestDtoPayload }
  | { ok: false; message: string } {
  const previousRequestId = input.previousRequestId.trim();
  if (!previousRequestId) {
    return { ok: false, message: "معرّف الطلب السابق غير متوفر." };
  }

  const startDate = input.startDateYmd.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return { ok: false, message: "تاريخ البدء غير صالح." };
  }

  const nights = Math.trunc(input.nights);
  if (!Number.isFinite(nights) || nights < 1) {
    return { ok: false, message: "عدد الليالي غير صالح." };
  }

  const requestTypeId = input.requestTypeId.trim();
  if (!requestTypeId) {
    return { ok: false, message: "نوع الطلب غير صالح." };
  }

  const requestAllocationType = parseAllocationTypeEnum(input.allocationTypeValue);
  if (!requestAllocationType) {
    return { ok: false, message: "نوع الحجز غير صالح." };
  }

  const requestToId = input.requestToId.trim();
  if (!requestToId) {
    return { ok: false, message: "الجهة الموجّه إليها الطلب غير متوفرة." };
  }

  return {
    ok: true,
    dto: {
      startDate,
      nights,
      requestTypeId,
      requestToId,
      percentage: 0,
      requestAllocationType,
      requestCatagory: HOUSING_REQUEST_CATAGORY_EXTENSION,
      previousRequestId,
      requestUnits: [],
      requestCompanions: [],
    },
  };
}


