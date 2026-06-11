import type { AvailableUnitType } from "@/actions/availabilityService";
import type { GenericOption, ReservationStoredUnitSnapshot } from "@/lib/availability-inquiry";
import { resolveInquiryGendersForRequest } from "@/lib/housing-request-detail";
import {
  extractNightsFromRequest,
  extractRequestAllocationTypeValue,
  extractRequestTypeId,
} from "@/lib/housing-request-list";
import {
  parseAllocationTypeEnum,
  type AddRequestUnitDtoPayload,
} from "@/lib/housing-request-map";
import type { GuestGender } from "@/lib/reservation-guest-unit-validation";

export type ExtendInquiryPrefill = {
  nights: string;
  selectedUnitTypes: AvailableUnitType[];
  requestType: string;
  selectedGenders: GuestGender[];
  allocationType: string;
};

function unitKindsFromRequestUnits(
  units: AddRequestUnitDtoPayload[],
): AvailableUnitType[] {
  const kinds = new Set<AvailableUnitType>();
  for (const unit of units) {
    if (unit.bedId) kinds.add("bed");
    else if (unit.roomId) kinds.add("room");
    else if (unit.apartmentId) kinds.add("apartment");
  }
  return [...kinds];
}

function resolveAllocationTypeOptionValue(
  raw: Record<string, unknown>,
  options: GenericOption[],
): string {
  const nested = raw.requestAllocationType ?? raw.RequestAllocationType;
  if (nested && typeof nested === "object") {
    const id = String(
      (nested as Record<string, unknown>).id ??
        (nested as Record<string, unknown>).Id ??
        "",
    ).trim();
    if (id && options.some((o) => o.value === id)) return id;
  }

  const enumVal = parseAllocationTypeEnum(
    extractRequestAllocationTypeValue(raw),
  );
  if (enumVal === 1) {
    return (
      options.find((o) => o.label === "ثابت" || o.value === "1")?.value ?? ""
    );
  }
  if (enumVal === 2) {
    return (
      options.find(
        (o) =>
          o.label === "مرن" || o.label === "متحرك" || o.value === "2",
      )?.value ?? ""
    );
  }

  for (const key of ["requestAllocationTypeId", "RequestAllocationTypeId"]) {
    const id = String(raw[key] ?? "").trim();
    if (id && options.some((o) => o.value === id)) return id;
  }

  return "";
}

export function mapHousingRequestToExtendInquiryPrefill(input: {
  requestRaw: Record<string, unknown>;
  requestUnits: AddRequestUnitDtoPayload[];
  unitSnapshots?: ReservationStoredUnitSnapshot[];
  bedsRaw?: unknown[];
  roomsRaw?: unknown[];
  apartmentsRaw?: unknown[];
  participantRows?: Record<string, unknown>[];
  requestTypeOptions: GenericOption[];
  allocationTypeOptions: GenericOption[];
}): ExtendInquiryPrefill {
  const { requestRaw, requestUnits, unitSnapshots = [] } = input;

  const nightsNum = extractNightsFromRequest(requestRaw);
  const selectedUnitTypes = unitKindsFromRequestUnits(requestUnits);

  let requestType = extractRequestTypeId(requestRaw);
  if (
    requestType &&
    !input.requestTypeOptions.some((o) => o.value === requestType)
  ) {
    const nested = requestRaw.requestType ?? requestRaw.RequestType;
    const label =
      nested && typeof nested === "object"
        ? String(
            (nested as Record<string, unknown>).nameAr ??
              (nested as Record<string, unknown>).NameAr ??
              "",
          ).trim()
        : "";
    const match = input.requestTypeOptions.find((o) => o.label === label);
    requestType = match?.value ?? requestType;
  }

  const availability =
    input.bedsRaw && input.roomsRaw && input.apartmentsRaw
      ? {
          bedsRaw: input.bedsRaw,
          roomsRaw: input.roomsRaw,
          apartmentsRaw: input.apartmentsRaw,
        }
      : undefined;

  const selectedGenders = resolveInquiryGendersForRequest(
    requestRaw,
    unitSnapshots,
    availability,
    input.participantRows,
  );

  const allocationType = resolveAllocationTypeOptionValue(
    requestRaw,
    input.allocationTypeOptions,
  );

  return {
    nights: nightsNum > 0 ? String(nightsNum) : "",
    selectedUnitTypes,
    requestType,
    selectedGenders,
    allocationType,
  };
}
