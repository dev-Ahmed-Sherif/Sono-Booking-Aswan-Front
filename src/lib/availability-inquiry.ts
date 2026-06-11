import {
  getAvailableUnits,
  loadUnitBlockingEndIndex,
  type AvailableUnitType,
} from "@/actions/availabilityService";
export {
  normalizeInquiryStartYmd,
  type AvailabilityInquiryDates,
} from "@/lib/availability-dates";
import type { AvailabilityInquiryDates } from "@/lib/availability-dates";
import {
  filterBedsWithAvailableRoom,
  filterRoomsWithAvailableApartment,
  applyAvailabilityHierarchyFilters,
} from "@/lib/availability-hierarchy";
import type { UnitBlockingEndIndex } from "@/lib/availability-occupancy";

export type AvailabilityUnitCard = {
  id: string;
  unitKind: AvailableUnitType;
  title: string;
  subtitle: string;
  /** Parent apartment id (for validation/display; not sent on add request). */
  apartmentId?: string;
  /** Parent room id when `unitKind` is `bed`. */
  roomId?: string;
  /** Display label for parent room (bed cards). */
  parentRoomLabel?: string;
  /** Display label for parent apartment (bed / room cards). */
  parentApartmentLabel?: string;
  /** Unit gender / gender-type label when the API provides it (Arabic or normalized). */
  genderType?: string;
  /** Building number for display (Arabic numerals when numeric). */
  buildingNumberAr?: string;
  /** City / governorate name from API. */
  city?: string;
  priceLabel?: string;
};

export type GenericOption = { value: string; label: string };

export const UNIT_TYPE_LABEL_AR: Record<string, string> = {
  bed: "سرير",
  room: "غرفة",
  apartment: "شقة كاملة",
};

export function availabilityCardKey(card: AvailabilityUnitCard): string {
  return `${card.unitKind}:${card.id}`;
}

/** Fields persisted under `reservation.selectedUnits` in localStorage. */
export type ReservationStoredUnitSnapshot = Pick<
  AvailabilityUnitCard,
  | "id"
  | "unitKind"
  | "title"
  | "subtitle"
  | "apartmentId"
  | "roomId"
  | "parentRoomLabel"
  | "parentApartmentLabel"
  | "priceLabel"
  | "genderType"
  | "buildingNumberAr"
  | "city"
>;

export function toReservationStoredUnits(
  units: AvailabilityUnitCard[],
): ReservationStoredUnitSnapshot[] {
  return units.map((u) => ({
    id: u.id,
    unitKind: u.unitKind,
    title: u.title,
    subtitle: u.subtitle,
    ...(u.apartmentId ? { apartmentId: u.apartmentId } : {}),
    ...(u.roomId ? { roomId: u.roomId } : {}),
    priceLabel: u.priceLabel,
    genderType: u.genderType,
    ...(u.parentRoomLabel ? { parentRoomLabel: u.parentRoomLabel } : {}),
    ...(u.parentApartmentLabel
      ? { parentApartmentLabel: u.parentApartmentLabel }
      : {}),
    buildingNumberAr: u.buildingNumberAr,
    city: u.city,
  }));
}

export function getLookupArray(response: unknown): unknown[] {
  if (Array.isArray(response)) return response;
  if (!response || typeof response !== "object") return [];

  const obj = response as Record<string, unknown>;
  const level1 =
    obj.data ?? obj.Data ?? obj.items ?? obj.Items ?? obj.result ?? obj.Result;
  if (Array.isArray(level1)) return level1;
  if (level1 && typeof level1 === "object") {
    const nested = level1 as Record<string, unknown>;
    const level2 =
      nested.data ??
      nested.Data ??
      nested.items ??
      nested.Items ??
      nested.result ??
      nested.Result;
    if (Array.isArray(level2)) return level2;
  }
  return [];
}

export function mapGenericOptions(response: unknown): GenericOption[] {
  return getLookupArray(response)
    .map((item) => item as Record<string, unknown>)
    .map((item) => {
      const value = String(
        item.id ??
          item.Id ??
          item.value ??
          item.Value ??
          item.nameEn ??
          item.NameEn ??
          "",
      ).trim();
      const label = String(
        item.nameAr ??
          item.NameAr ??
          item.nameEn ??
          item.NameEn ??
          item.value ??
          item.Value ??
          value,
      ).trim();
      return { value, label };
    })
    .filter((item) => item.value.length > 0 && item.label.length > 0);
}

function pickStr(r: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = r[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function normalizeGenderPrimitive(v: unknown): string | undefined {
  if (v == null) return undefined;
  const t = String(v).trim();
  if (!t) return undefined;
  const s = t.toLowerCase();
  const ascii = normalizeDigitsToAscii(s);
  if (
    s === "male" ||
    s === "m" ||
    ascii === "1" ||
    s === "ذكر" ||
    s === "man" ||
    s === "رجال"
  ) {
    return "رجال";
  }
  if (
    s === "female" ||
    s === "f" ||
    ascii === "2" ||
    s === "أنثى" ||
    s === "انثى" ||
    s === "woman" ||
    s === "سيدات"
  ) {
    return "سيدات";
  }
  if (t.length > 0 && t.length <= 64) return t;
  return undefined;
}

function pickNestedGenderObjectLabel(v: unknown): string | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const lbl = pickStr(
    o,
    "nameAr",
    "NameAr",
    "name",
    "Name",
    "title",
    "Title",
    "label",
    "Label",
  );
  if (lbl) return normalizeGenderPrimitive(lbl) ?? lbl;
  const idish = o.id ?? o.Id ?? o.value ?? o.Value;
  return normalizeGenderPrimitive(idish);
}

/** Prefer first non-empty gender label from API rows (bed → room → apartment chain). */
function mergeGenderFromRows(
  ...rows: Array<Record<string, unknown> | undefined>
): string | undefined {
  for (const row of rows) {
    if (!row) continue;
    const g = pickGenderTypeLabel(row);
    if (g) return g;
  }
  return undefined;
}

function pickGenderTypeLabel(
  r: Record<string, unknown>,
): string | undefined {
  const nestedKeys = [
    "genderType",
    "GenderType",
    "gender",
    "Gender",
    "genderNavigation",
    "GenderNavigation",
    "unitGenderType",
    "UnitGenderType",
  ] as const;
  for (const k of nestedKeys) {
    const raw = r[k];
    if (raw != null && typeof raw !== "object") {
      const prim = normalizeGenderPrimitive(raw);
      if (prim) return prim;
    }
    const nested = pickNestedGenderObjectLabel(raw);
    if (nested) return nested;
  }

  const direct = pickStr(
    r,
    "genderTypeName",
    "GenderTypeName",
    "genderNameAr",
    "GenderNameAr",
    "genderNameEn",
    "GenderNameEn",
    "genderName",
    "GenderName",
    "unitGender",
    "UnitGender",
    "genderLabel",
    "GenderLabel",
  );
  if (direct) return normalizeGenderPrimitive(direct) ?? direct;

  const idish =
    r.genderId ?? r.GenderId ?? r.genderTypeId ?? r.GenderTypeId ?? r.sex ?? r.Sex;
  const fromId = normalizeGenderPrimitive(idish);
  if (fromId) return fromId;

  const rawGender = r.gender ?? r.Gender;
  if (rawGender != null && typeof rawGender !== "object") {
    return normalizeGenderPrimitive(rawGender);
  }

  return undefined;
}

/** Gender label from a single availability API row (bed / room / apartment). */
export function pickAvailabilityRowGenderLabel(
  row: Record<string, unknown>,
): string | undefined {
  return pickGenderTypeLabel(row);
}

/** First non-empty gender label along bed → room → apartment chain. */
export function mergeAvailabilityGenderFromRows(
  ...rows: Array<Record<string, unknown> | undefined>
): string | undefined {
  return mergeGenderFromRows(...rows);
}

function normalizeDigitsToAscii(s: string): string {
  const map: Record<string, string> = {
    "٠": "0",
    "١": "1",
    "٢": "2",
    "٣": "3",
    "٤": "4",
    "٥": "5",
    "٦": "6",
    "٧": "7",
    "٨": "8",
    "٩": "9",
    "۰": "0",
    "۱": "1",
    "۲": "2",
    "۳": "3",
    "۴": "4",
    "۵": "5",
    "۶": "6",
    "۷": "7",
    "۸": "8",
    "۹": "9",
  };
  let out = "";
  for (const ch of s) {
    out += map[ch] ?? ch;
  }
  return out;
}

function extractDigitsOnly(raw: string): string {
  return normalizeDigitsToAscii(raw.trim()).replace(/\D/g, "");
}

function formatArUnitNumber(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  const digits = extractDigitsOnly(t);
  if (!digits) return "";
  const n = Number(digits);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("ar-EG");
}

function indexRowsById(rows: unknown[]): Map<string, Record<string, unknown>> {
  const m = new Map<string, Record<string, unknown>>();
  for (const item of rows) {
    const r = item as Record<string, unknown>;
    const id = pickStr(r, "id", "Id");
    if (id) m.set(id.trim().toLowerCase(), r);
  }
  return m;
}

function pickBuildingNumberAr(r: Record<string, unknown>): string | undefined {
  const raw = pickStr(
    r,
    "buildingNumber",
    "BuildingNumber",
    "buildingNo",
    "BuildingNo",
    "building",
    "Building",
  );
  if (!raw) return undefined;
  const ar = formatArUnitNumber(raw);
  return ar || raw.trim();
}

function pickCityName(r: Record<string, unknown>): string | undefined {
  let c = pickStr(
    r,
    "city",
    "City",
    "cityName",
    "CityName",
    "governorate",
    "Governorate",
    "governorateName",
    "GovernorateName",
  );
  if (c) return c;
  const cityObj = r.city ?? r.City ?? r.governorate ?? r.Governorate;
  if (cityObj && typeof cityObj === "object") {
    const o = cityObj as Record<string, unknown>;
    c = pickStr(o, "nameAr", "NameAr", "name", "Name", "title", "Title");
    if (c) return c;
  }
  return undefined;
}

function mergeBuildingNumberArFromRows(
  ...rows: Array<Record<string, unknown> | undefined>
): string | undefined {
  for (const row of rows) {
    if (!row) continue;
    const b = pickBuildingNumberAr(row);
    if (b) return b;
  }
  return undefined;
}

function mergeCityFromRows(
  ...rows: Array<Record<string, unknown> | undefined>
): string | undefined {
  for (const row of rows) {
    if (!row) continue;
    const c = pickCityName(row);
    if (c) return c;
  }
  return undefined;
}

function pickPriceLabel(
  ...rows: Array<Record<string, unknown> | undefined>
): string | undefined {
  for (const r of rows) {
    if (!r) continue;
    const price =
      r.price ??
      r.Price ??
      r.unitPrice ??
      r.UnitPrice ??
      r.pricePerNight ??
      r.PricePerNight ??
      r.nightlyPrice ??
      r.NightlyPrice;
    if (price != null && Number.isFinite(Number(price))) {
      return `${Number(price).toLocaleString("ar-EG")} ج.م`;
    }
  }
  return undefined;
}

function mapRawToCards(
  unitType: AvailableUnitType,
  raw: unknown[],
): AvailabilityUnitCard[] {
  return raw.map((item, idx) => {
    const r = item as Record<string, unknown>;
    const id = pickStr(r, "id", "Id") || `row-${idx}`;
    const priceLabel = pickPriceLabel(r);

    const genderType = pickGenderTypeLabel(r);
    const buildingNumberAr = mergeBuildingNumberArFromRows(r);
    const city = mergeCityFromRows(r);
    const locFields = {
      ...(buildingNumberAr ? { buildingNumberAr } : {}),
      ...(city ? { city } : {}),
    };

    if (unitType === "bed") {
      const num = pickStr(r, "bedNumber", "BedNumber");
      const numAr = num ? formatArUnitNumber(num) : "";
      const desc = pickStr(r, "description", "Description");
      return {
        id,
        unitKind: "bed",
        title: numAr ? `سرير ${numAr}` : "سرير",
        subtitle: desc ? desc.slice(0, 120) : "—",
        ...(genderType ? { genderType } : {}),
        ...locFields,
        priceLabel,
      };
    }
    if (unitType === "room") {
      const num = pickStr(r, "roomNumber", "RoomNumber");
      const numAr = num ? formatArUnitNumber(num) : "";
      const desc = pickStr(r, "description", "Description");
      const rt = pickStr(r, "roomType", "RoomType");
      const sub = [rt, desc ? desc.slice(0, 100) : ""]
        .filter(Boolean)
        .join(" · ");
      return {
        id,
        unitKind: "room",
        title: numAr ? `غرفة ${numAr}` : "غرفة",
        subtitle: sub || "—",
        ...(genderType ? { genderType } : {}),
        ...locFields,
        priceLabel,
      };
    }
    const num = pickStr(r, "apartmentNumber", "ApartmentNumber");
    const numAr = num ? formatArUnitNumber(num) : "";
    const desc = pickStr(r, "description", "Description");
    const at = pickStr(r, "apartmentType", "ApartmentType");
    const sub = [at, desc ? desc.slice(0, 80) : ""]
      .filter(Boolean)
      .join(" · ");
    return {
      id,
      unitKind: "apartment",
      title: numAr ? `شقة ${numAr}` : "شقة",
      subtitle: sub || "—",
      ...(genderType ? { genderType } : {}),
      ...locFields,
      priceLabel,
    };
  });
}

function findAvailabilityRowById(
  raw: unknown[],
  id: string,
): Record<string, unknown> | undefined {
  const key = id.trim().toLowerCase();
  if (!key) return undefined;
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const rowId = pickStr(r, "id", "Id");
    if (rowId.toLowerCase() === key) return r;
  }
  return undefined;
}

/** Human-readable label for a stored unit (no raw ids). */
export function formatStoredUnitLabel(
  unit: ReservationStoredUnitSnapshot,
): string {
  const title =
    unit.title?.trim() ||
    UNIT_TYPE_LABEL_AR[unit.unitKind] ||
    "وحدة";
  const sub = unit.subtitle?.trim();
  if (!sub || sub === "—") return title;
  return `${title} · ${sub}`;
}

/**
 * Builds a display snapshot from a saved request unit row using availability lookup data.
 */
export function unitSnapshotFromRequestUnitDto(
  dto: {
    apartmentId?: string;
    bedId?: string | null;
    roomId?: string | null;
  },
  bedsRaw: unknown[],
  roomsRaw: unknown[],
  apartmentsRaw: unknown[],
): ReservationStoredUnitSnapshot {
  if (dto.bedId?.trim()) {
    const id = dto.bedId.trim();
    const row = findAvailabilityRowById(bedsRaw, id);
    const roomId =
      dto.roomId?.trim() ||
      (row ? pickStr(row, "roomId", "RoomId") : "");
    const room = roomId ? findAvailabilityRowById(roomsRaw, roomId) : undefined;
    const aptId =
      dto.apartmentId?.trim() ||
      (room ? pickStr(room, "apartmentId", "ApartmentId") : "");
    const apt = aptId ? findAvailabilityRowById(apartmentsRaw, aptId) : undefined;
    const card = row
      ? mapRawToCards("bed", [row])[0]
      : {
          id,
          unitKind: "bed" as const,
          title: "سرير",
          subtitle: "—",
        };
    return toReservationStoredUnits([
      {
        ...card,
        id,
        title: row ? formatBedLabel(row as Record<string, unknown>) : card.title,
        apartmentId: aptId || card.apartmentId,
        roomId: roomId || card.roomId,
        ...(room
          ? { parentRoomLabel: formatRoomLabel(room as Record<string, unknown>) }
          : {}),
        ...(apt
          ? {
              parentApartmentLabel: formatApartmentLabel(
                apt as Record<string, unknown>,
              ),
            }
          : {}),
      },
    ])[0]!;
  }

  if (dto.roomId?.trim()) {
    const id = dto.roomId.trim();
    const row = findAvailabilityRowById(roomsRaw, id);
    const aptId =
      dto.apartmentId?.trim() ||
      (row ? pickStr(row, "apartmentId", "ApartmentId") : "");
    const apt = aptId ? findAvailabilityRowById(apartmentsRaw, aptId) : undefined;
    const card = row
      ? mapRawToCards("room", [row])[0]
      : {
          id,
          unitKind: "room" as const,
          title: "غرفة",
          subtitle: "—",
        };
    return toReservationStoredUnits([
      {
        ...card,
        id,
        title: row ? formatRoomLabel(row as Record<string, unknown>) : card.title,
        apartmentId: aptId || card.apartmentId,
        ...(apt
          ? {
              parentApartmentLabel: formatApartmentLabel(
                apt as Record<string, unknown>,
              ),
            }
          : {}),
      },
    ])[0]!;
  }

  const id = dto.apartmentId?.trim() ?? "";
  if (!id) {
    return toReservationStoredUnits([
      {
        id: "",
        unitKind: "apartment" as const,
        title: "شقة",
        subtitle: "—",
      },
    ])[0]!;
  }
  const row = findAvailabilityRowById(apartmentsRaw, id);
  const card = row
    ? mapRawToCards("apartment", [row])[0]
    : {
        id,
        unitKind: "apartment" as const,
        title: "شقة",
        subtitle: "—",
      };
  return toReservationStoredUnits([
    {
      ...card,
      id,
      apartmentId: id,
      roomId: undefined,
    },
  ])[0]!;
}

function formatBedLabel(r: Record<string, unknown>): string {
  const num = pickStr(r, "bedNumber", "BedNumber");
  const numAr = num ? formatArUnitNumber(num) : "";
  return numAr ? `سرير ${numAr}` : "سرير";
}

function formatRoomLabel(r: Record<string, unknown>): string {
  const num = pickStr(r, "roomNumber", "RoomNumber");
  const numAr = num ? formatArUnitNumber(num) : "";
  return numAr ? `غرفة ${numAr}` : "غرفة";
}

function formatApartmentLabel(r: Record<string, unknown>): string {
  const num = pickStr(r, "apartmentNumber", "ApartmentNumber");
  const numAr = num ? formatArUnitNumber(num) : "";
  return numAr ? `شقة ${numAr}` : "شقة";
}

export type AvailabilityHierarchyRaw = {
  apartmentsRaw?: unknown[];
  roomsRaw?: unknown[];
};

export async function enrichAvailabilityCards(
  unitKind: AvailableUnitType,
  rawList: unknown[],
  hierarchy?: AvailabilityHierarchyRaw,
): Promise<AvailabilityUnitCard[]> {
  if (unitKind === "apartment") {
    const base = mapRawToCards(unitKind, rawList);
    const safeBase = (idx: number): AvailabilityUnitCard =>
      base[idx] ?? {
        id: `row-${idx}`,
        unitKind,
        title: "شقة",
        subtitle: "—",
      };

    return rawList.map((item, idx) => {
      const r = item as Record<string, unknown>;
      const aptNum = pickStr(r, "apartmentNumber", "ApartmentNumber");
      const aptAr = aptNum ? formatArUnitNumber(aptNum) : "";
      const bld = pickStr(r, "buildingNumber", "BuildingNumber");
      const fl = pickStr(r, "floor", "Floor");
      const bldAr = bld ? formatArUnitNumber(bld) : "";
      const flAr = fl ? formatArUnitNumber(fl) : "";
      const parts = [
        aptAr && `شقة ${aptAr}`,
        bldAr && `مبنى ${bldAr}`,
        flAr && `طابق ${flAr}`,
      ].filter(Boolean);
      const b = safeBase(idx);
      const title = parts.length > 0 ? parts.join(" — ") : b.title;
      const genderType = mergeGenderFromRows(r) ?? b.genderType;
      const buildingNumberAr =
        mergeBuildingNumberArFromRows(r) ?? b.buildingNumberAr;
      const cityMerged = mergeCityFromRows(r) ?? b.city;
      const aptId = pickStr(r, "id", "Id");
      const priceLabel = pickPriceLabel(r) ?? b.priceLabel;
      return {
        ...b,
        title,
        apartmentId: aptId || b.apartmentId,
        ...(priceLabel ? { priceLabel } : {}),
        ...(genderType ? { genderType } : {}),
        ...(buildingNumberAr ? { buildingNumberAr } : {}),
        ...(cityMerged ? { city: cityMerged } : {}),
      };
    });
  }

  if (unitKind === "room") {
    let aptRows: unknown[] = hierarchy?.apartmentsRaw ?? [];
    if (!aptRows.length) {
      const aptRes = await getAvailableUnits("apartment");
      if ("error" in aptRes && aptRes.error) {
        return mapRawToCards(unitKind, rawList);
      }
      aptRows = Array.isArray(aptRes.data) ? aptRes.data : [];
    }
    const aptById = indexRowsById(aptRows);
    const workingList = filterRoomsWithAvailableApartment(rawList, aptRows);
    const base = mapRawToCards(unitKind, workingList);
    const safeBase = (idx: number): AvailabilityUnitCard =>
      base[idx] ?? {
        id: `row-${idx}`,
        unitKind,
        title: "غرفة",
        subtitle: "—",
      };

    return workingList.map((item, idx) => {
      const r = item as Record<string, unknown>;
      const b = safeBase(idx);
      const roomId = pickStr(r, "id", "Id");
      const aptId = pickStr(r, "apartmentId", "ApartmentId");
      const apt = aptId ? aptById.get(aptId.trim().toLowerCase()) : undefined;
      const parentApartmentLabel = apt ? formatApartmentLabel(apt) : undefined;
      const title = formatRoomLabel(r);
      const genderType = mergeGenderFromRows(r, apt) ?? b.genderType;
      const buildingNumberAr =
        mergeBuildingNumberArFromRows(r, apt) ?? b.buildingNumberAr;
      const cityMerged = mergeCityFromRows(r, apt) ?? b.city;
      const priceLabel = pickPriceLabel(r, apt) ?? b.priceLabel;
      return {
        ...b,
        title,
        apartmentId: aptId || b.apartmentId,
        roomId: roomId || b.roomId,
        ...(parentApartmentLabel ? { parentApartmentLabel } : {}),
        ...(priceLabel ? { priceLabel } : {}),
        ...(genderType ? { genderType } : {}),
        ...(buildingNumberAr ? { buildingNumberAr } : {}),
        ...(cityMerged ? { city: cityMerged } : {}),
      };
    });
  }

  let roomRows: unknown[] = hierarchy?.roomsRaw ?? [];
  let aptRows: unknown[] = hierarchy?.apartmentsRaw ?? [];
  if (!roomRows.length || !aptRows.length) {
    const [roomRes, aptRes] = await Promise.all([
      roomRows.length
        ? Promise.resolve({ data: roomRows })
        : getAvailableUnits("room"),
      aptRows.length
        ? Promise.resolve({ data: aptRows })
        : getAvailableUnits("apartment"),
    ]);
    if (!roomRows.length) {
      roomRows =
        !("error" in roomRes && roomRes.error) && Array.isArray(roomRes.data)
          ? roomRes.data
          : [];
    }
    if (!aptRows.length) {
      aptRows =
        !("error" in aptRes && aptRes.error) && Array.isArray(aptRes.data)
          ? aptRes.data
          : [];
    }
  }

  const roomById = indexRowsById(roomRows);
  const aptById = indexRowsById(aptRows);
  const roomsWithAvailableApartment = filterRoomsWithAvailableApartment(
    roomRows,
    aptRows,
  );
  const workingList = filterBedsWithAvailableRoom(
    rawList,
    roomsWithAvailableApartment,
  );
  const base = mapRawToCards(unitKind, workingList);
  const safeBase = (idx: number): AvailabilityUnitCard =>
    base[idx] ?? {
      id: `row-${idx}`,
      unitKind,
      title: "سرير",
      subtitle: "—",
    };

  return workingList.map((item, idx) => {
    const r = item as Record<string, unknown>;
    const b = safeBase(idx);
    const roomId = pickStr(r, "roomId", "RoomId");
    const room = roomId ? roomById.get(roomId.trim().toLowerCase()) : undefined;
    const aptId = room ? pickStr(room, "apartmentId", "ApartmentId") : "";
    const apt = aptId ? aptById.get(aptId.trim().toLowerCase()) : undefined;
    const parentRoomLabel = room ? formatRoomLabel(room) : undefined;
    const parentApartmentLabel = apt ? formatApartmentLabel(apt) : undefined;
    const title = formatBedLabel(r);
    const genderType = mergeGenderFromRows(r, room, apt) ?? b.genderType;
    const buildingNumberAr =
      mergeBuildingNumberArFromRows(r, room, apt) ?? b.buildingNumberAr;
    const cityMerged = mergeCityFromRows(r, room, apt) ?? b.city;
    const priceLabel = pickPriceLabel(r, room, apt) ?? b.priceLabel;
    return {
      ...b,
      title,
      apartmentId: aptId || b.apartmentId,
      roomId: roomId || b.roomId,
      ...(parentRoomLabel ? { parentRoomLabel } : {}),
      ...(parentApartmentLabel ? { parentApartmentLabel } : {}),
      ...(priceLabel ? { priceLabel } : {}),
      ...(genderType ? { genderType } : {}),
      ...(buildingNumberAr ? { buildingNumberAr } : {}),
      ...(cityMerged ? { city: cityMerged } : {}),
    };
  });
}

/** Stable order when merging availability from multiple kinds. */
export const ORDERED_UNIT_KINDS: readonly AvailableUnitType[] = [
  "bed",
  "room",
  "apartment",
];

/** All unit types for inquiry forms (always shown; availability is checked on search). */
export const ALL_UNIT_TYPE_OPTIONS: GenericOption[] = ORDERED_UNIT_KINDS.map(
  (kind) => ({
    value: kind,
    label: UNIT_TYPE_LABEL_AR[kind] ?? kind,
  }),
);

export function unavailableUnitKindsAfterSearch(
  searchedKinds: AvailableUnitType[],
  cards: AvailabilityUnitCard[],
): AvailableUnitType[] {
  return searchedKinds.filter(
    (kind) => !cards.some((card) => card.unitKind === kind),
  );
}

/** Arabic message for unit types with no availability after a successful search. */
export function getUnavailableUnitTypesMessage(
  searchedKinds: AvailableUnitType[],
  cards: AvailabilityUnitCard[],
): string | null {
  const unavailable = unavailableUnitKindsAfterSearch(searchedKinds, cards);
  if (unavailable.length === 0) return null;

  const labels = unavailable.map((k) => UNIT_TYPE_LABEL_AR[k] ?? k);
  if (unavailable.length === searchedKinds.length) {
    if (labels.length === 1) {
      return `لا يوجد ${labels[0]} متاح للتواريخ المحددة`;
    }
    return `لا توجد وحدات متاحة (${labels.join(" و ")}) للتواريخ المحددة`;
  }
  return `لا يوجد ${labels.join("، ")} متاح للتواريخ المحددة`;
}

export function orderedUnitKindsFromSelection(
  selected: Iterable<string>,
): AvailableUnitType[] {
  const set = new Set<string>();
  for (const v of Array.from(selected)) {
    if (v === "bed" || v === "room" || v === "apartment") set.add(v);
  }
  return ORDERED_UNIT_KINDS.filter((k) => set.has(k));
}

/**
 * Fetches and enriches cards for each kind, concatenating results (keys are unique per kind:id).
 */
export async function fetchMergedAvailabilityCards(
  kinds: AvailableUnitType[],
  inquiry?: AvailabilityInquiryDates,
): Promise<{
  cards: AvailabilityUnitCard[];
  fatalError?: string;
  partialFailure?: boolean;
  occupancyIndex?: UnitBlockingEndIndex | null;
}> {
  if (kinds.length === 0) return { cards: [] };

  const kindsToFetch = new Set<AvailableUnitType>(kinds);
  if (inquiry?.startDateYmd?.trim()) {
    kindsToFetch.add("apartment");
    kindsToFetch.add("room");
    kindsToFetch.add("bed");
  }

  const rawByKind: Partial<Record<AvailableUnitType, unknown[]>> = {};
  let failures = 0;
  let lastMessage: string | undefined;

  await Promise.all(
    Array.from(kindsToFetch).map(async (unitKind: AvailableUnitType) => {
      // StartDate expands catalog to Reserved/Occupied and applies ActualCheckOutDate
      // occupancy on the API (noon rule). Client hierarchy only wires parent/child ids.
      const res = await getAvailableUnits(unitKind, inquiry);
      if ("error" in res && res.error) {
        if (kinds.includes(unitKind)) {
          failures += 1;
          lastMessage =
            (res as { message?: string }).message ?? "تعذر الاتصال بالخادم";
        }
        return;
      }
      rawByKind[unitKind] = Array.isArray(res.data) ? res.data : [];
    }),
  );

  const apartmentsRaw = rawByKind.apartment ?? [];
  const roomsRaw = rawByKind.room ?? [];
  const bedsRaw = rawByKind.bed ?? [];

  const occupancyIndex =
    inquiry?.startDateYmd?.trim()
      ? await loadUnitBlockingEndIndex(bedsRaw, roomsRaw)
      : null;

  const filtered = applyAvailabilityHierarchyFilters({
    apartments: apartmentsRaw,
    rooms: roomsRaw,
    beds: bedsRaw,
    hierarchyRaw: { apartmentsRaw, roomsRaw },
    ...(inquiry?.startDateYmd
      ? { inquiry, occupancyIndex }
      : {}),
  });

  const merged: AvailabilityUnitCard[] = [];
  for (const unitKind of kinds) {
    const list =
      unitKind === "apartment"
        ? filtered.apartments
        : unitKind === "room"
          ? filtered.rooms
          : filtered.beds;
    merged.push(
      ...(await enrichAvailabilityCards(unitKind, list, {
        apartmentsRaw,
        roomsRaw,
      })),
    );
  }

  if (merged.length === 0 && failures > 0) {
    return { cards: [], fatalError: lastMessage };
  }

  return {
    cards: merged,
    partialFailure: failures > 0 && merged.length > 0,
    occupancyIndex,
  };
}

/** Normalize availability API lists with hierarchy and optional inquiry date filters. */
export async function hierarchyFilteredAvailabilityLists(input: {
  bedsRaw: unknown[];
  roomsRaw: unknown[];
  apartmentsRaw: unknown[];
  inquiry?: AvailabilityInquiryDates;
}): Promise<{
  bedsRaw: unknown[];
  roomsRaw: unknown[];
  apartmentsRaw: unknown[];
}> {
  const occupancyIndex = input.inquiry?.startDateYmd?.trim()
    ? await loadUnitBlockingEndIndex(input.bedsRaw, input.roomsRaw)
    : null;

  const filtered = applyAvailabilityHierarchyFilters({
    apartments: input.apartmentsRaw,
    rooms: input.roomsRaw,
    beds: input.bedsRaw,
    hierarchyRaw: {
      apartmentsRaw: input.apartmentsRaw,
      roomsRaw: input.roomsRaw,
    },
    ...(input.inquiry?.startDateYmd ? { inquiry: input.inquiry, occupancyIndex } : {}),
  });
  return {
    bedsRaw: filtered.beds,
    roomsRaw: filtered.rooms,
    apartmentsRaw: filtered.apartments,
  };
}
