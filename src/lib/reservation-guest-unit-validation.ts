import type { AvailableUnitType } from "@/actions/availabilityService";
import type { ReservationStoredUnitSnapshot } from "@/lib/availability-inquiry";
import {
  getLookupArray,
  mergeAvailabilityGenderFromRows,
} from "@/lib/availability-inquiry";
import { genderFromNationalId } from "@/lib/companion-registration";

export type GuestGender = "male" | "female";

const GENDER_LABEL_AR: Record<GuestGender, string> = {
  male: "رجال",
  female: "سيدات",
};

function pickStr(r: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = r[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

/** Strict gender parse (no default to male). Handles enum 1/2 and "Male"/"Female" strings. */
export function parseGuestGenderStrict(gender: unknown): GuestGender | undefined {
  if (gender === undefined || gender === null) return undefined;
  if (typeof gender === "number") {
    if (gender === 1) return "male";
    if (gender === 2) return "female";
    return undefined;
  }
  const t = String(gender).trim().toLowerCase();
  if (
    t === "male" ||
    t === "m" ||
    t === "1" ||
    t === "ذكر" ||
    t === "رجال" ||
    t === "man"
  ) {
    return "male";
  }
  if (
    t === "female" ||
    t === "f" ||
    t === "2" ||
    t === "أنثى" ||
    t === "انثى" ||
    t === "سيدات" ||
    t === "woman"
  ) {
    return "female";
  }
  return undefined;
}

/** Maps unit gender label / API value to guest gender bucket. */
export function normalizeUnitGender(
  genderType: string | undefined,
): GuestGender | undefined {
  if (!genderType?.trim()) return undefined;
  const t = genderType.trim().toLowerCase();
  if (
    t === "male" ||
    t === "m" ||
    t === "1" ||
    t === "ذكر" ||
    t === "رجال" ||
    t === "man"
  ) {
    return "male";
  }
  if (
    t === "female" ||
    t === "f" ||
    t === "2" ||
    t === "أنثى" ||
    t === "انثى" ||
    t === "سيدات" ||
    t === "woman"
  ) {
    return "female";
  }
  return undefined;
}

export function parseStoredReservationUnits(
  raw: unknown,
): ReservationStoredUnitSnapshot[] {
  if (!Array.isArray(raw)) return [];
  const out: ReservationStoredUnitSnapshot[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = pickStr(o, "id", "Id");
    const unitKind = pickStr(o, "unitKind", "UnitKind") as AvailableUnitType;
    const title = pickStr(o, "title", "Title");
    if (!id || !title) continue;
    if (unitKind !== "bed" && unitKind !== "room" && unitKind !== "apartment") {
      continue;
    }
    const apartmentId = pickStr(o, "apartmentId", "ApartmentId");
    const roomId = pickStr(o, "roomId", "RoomId");
    const genderType = pickStr(o, "genderType", "GenderType");
    const buildingNumberAr = pickStr(o, "buildingNumberAr", "BuildingNumberAr");
    const city = pickStr(o, "city", "City");
    const priceLabel = pickStr(o, "priceLabel", "PriceLabel");
    out.push({
      id,
      unitKind,
      title,
      subtitle: pickStr(o, "subtitle", "Subtitle") || "—",
      ...(apartmentId ? { apartmentId } : {}),
      ...(roomId ? { roomId } : {}),
      ...(genderType ? { genderType } : {}),
      ...(buildingNumberAr ? { buildingNumberAr } : {}),
      ...(city ? { city } : {}),
      ...(priceLabel ? { priceLabel } : {}),
    });
  }
  return out;
}

export function parseInquiryGenders(
  form: Record<string, unknown> | undefined,
): GuestGender[] {
  if (!form) return [];
  const out: GuestGender[] = [];
  const pushUnique = (g: GuestGender | undefined) => {
    if (g && !out.includes(g)) out.push(g);
  };

  const genders = form.genders ?? form.Genders;
  if (Array.isArray(genders)) {
    for (const v of genders) {
      if (v === "male" || v === "female") pushUnique(v);
      else pushUnique(parseGuestGenderStrict(v));
    }
    if (out.length) return out;
  }

  const genderLabels = form.genderLabels ?? form.GenderLabels;
  if (Array.isArray(genderLabels)) {
    for (const v of genderLabels) {
      pushUnique(normalizeUnitGender(String(v)));
    }
    if (out.length) return out;
  }

  const legacy = form.gender ?? form.Gender;
  if (legacy === "male" || legacy === "female") return [legacy];
  pushUnique(parseGuestGenderStrict(legacy));
  const legacyLabel = form.genderLabel ?? form.GenderLabel;
  pushUnique(
    normalizeUnitGender(
      typeof legacyLabel === "string" ? legacyLabel : String(legacyLabel ?? ""),
    ),
  );
  return out;
}

/** Companion / applicant gender from API enum or Egyptian national ID (no default to male). */
export function resolvePersonGuestGender(
  row: Record<string, unknown>,
): GuestGender | undefined {
  const fromApi = parseGuestGenderStrict(row.gender ?? row.Gender);
  if (fromApi) return fromApi;
  const doc = pickStr(
    row,
    "documentNumber",
    "DocumentNumber",
    "nationalId",
    "NationalId",
  );
  if (doc.length >= 13) {
    return genderFromNationalId(doc) === 2 ? "female" : "male";
  }
  return undefined;
}

type BedCapacityIndex = {
  bedsPerRoom: Map<string, number>;
  bedsPerApartment: Map<string, number>;
};

export function buildBedCapacityIndex(
  bedsRaw: unknown[],
  roomsRaw: unknown[],
): BedCapacityIndex {
  const roomToApartment = new Map<string, string>();
  for (const item of roomsRaw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const roomId = pickStr(r, "id", "Id");
    const aptId = pickStr(r, "apartmentId", "ApartmentId");
    if (roomId && aptId) {
      roomToApartment.set(roomId.toLowerCase(), aptId.toLowerCase());
    }
  }

  const bedsPerRoom = new Map<string, number>();
  const bedsPerApartment = new Map<string, number>();

  for (const item of bedsRaw) {
    if (!item || typeof item !== "object") continue;
    const b = item as Record<string, unknown>;
    const roomId = pickStr(b, "roomId", "RoomId");
    if (!roomId) continue;
    const rk = roomId.toLowerCase();
    bedsPerRoom.set(rk, (bedsPerRoom.get(rk) ?? 0) + 1);
    const aptId = roomToApartment.get(rk);
    if (aptId) {
      bedsPerApartment.set(aptId, (bedsPerApartment.get(aptId) ?? 0) + 1);
    }
  }

  return { bedsPerRoom, bedsPerApartment };
}

function unitBedCapacity(
  unit: ReservationStoredUnitSnapshot,
  index: BedCapacityIndex,
): number {
  if (unit.unitKind === "bed") return 1;
  const id = unit.id.toLowerCase();
  if (unit.unitKind === "room") {
    return index.bedsPerRoom.get(id) ?? 0;
  }
  return index.bedsPerApartment.get(id) ?? 0;
}

const PICK_ROW_GUEST_PREFIX = "__pick__:";

export function isPickPlaceholderGuestId(id: string): boolean {
  return id.startsWith(PICK_ROW_GUEST_PREFIX);
}

/**
 * Everyone who counts toward the reservation: طالب الإقامة (always) plus each
 * companion row with a chosen person (not an empty «اختر مرافقاً» placeholder).
 */
export function resolveGuestsForReservationValidation(
  guests: { id: string; name: string; role: "applicant" | "companion" }[],
): { id: string; name: string; role: "applicant" | "companion" }[] {
  const out: typeof guests = [];
  for (const g of guests) {
    if (g.role === "applicant") {
      out.push(g);
      continue;
    }
    if (isPickPlaceholderGuestId(g.id)) continue;
    if (!g.name.trim()) continue;
    out.push(g);
  }
  return out;
}

function indexRowsById(rows: unknown[]): Map<string, Record<string, unknown>> {
  const m = new Map<string, Record<string, unknown>>();
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const id = pickStr(r, "id", "Id");
    if (id) m.set(id.toLowerCase(), r);
  }
  return m;
}

/** `AllocationType` enum: Fixed = 1, Flexible = 2. */
function parseApartmentAllocationType(value: unknown): 1 | 2 | undefined {
  if (value === 1 || value === 2) return value;
  const s = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!s) return undefined;
  if (s === "1" || s === "fixed" || s === "ثابت") return 1;
  if (
    s === "2" ||
    s === "flexible" ||
    s === "مرن" ||
    s === "متحرك" ||
    s === "movable"
  ) {
    return 2;
  }
  const n = Number(s);
  if (n === 1 || n === 2) return n as 1 | 2;
  return undefined;
}

function apartmentRowForUnit(
  unit: ReservationStoredUnitSnapshot,
  aptById: Map<string, Record<string, unknown>>,
  roomById: Map<string, Record<string, unknown>>,
  bedById: Map<string, Record<string, unknown>>,
): Record<string, unknown> | undefined {
  const id = unit.id.toLowerCase();
  if (unit.unitKind === "apartment") {
    return aptById.get(id);
  }
  if (unit.unitKind === "room") {
    const room = roomById.get(id);
    const aptId = room ? pickStr(room, "apartmentId", "ApartmentId") : "";
    return aptId ? aptById.get(aptId.toLowerCase()) : undefined;
  }
  if (unit.unitKind === "bed") {
    const bed = bedById.get(id);
    const roomId = bed ? pickStr(bed, "roomId", "RoomId") : "";
    const room = roomId ? roomById.get(roomId.toLowerCase()) : undefined;
    const aptId = room ? pickStr(room, "apartmentId", "ApartmentId") : "";
    return aptId ? aptById.get(aptId.toLowerCase()) : undefined;
  }
  return undefined;
}

/** Gender rules apply only when the parent apartment allocation type is ثابت (Fixed). */
export function isFixedApartmentAllocationForUnit(
  unit: ReservationStoredUnitSnapshot,
  aptById: Map<string, Record<string, unknown>>,
  roomById: Map<string, Record<string, unknown>>,
  bedById: Map<string, Record<string, unknown>>,
): boolean {
  const apt = apartmentRowForUnit(unit, aptById, roomById, bedById);
  if (!apt) return true;
  const allocationType = parseApartmentAllocationType(
    apt.allocationType ?? apt.AllocationType,
  );
  return allocationType !== 2;
}

/** Collect distinct inquiry genders from saved units using the availability hierarchy. */
export function collectInquiryGendersFromUnits(
  units: ReservationStoredUnitSnapshot[],
  bedsRaw: unknown[],
  roomsRaw: unknown[],
  apartmentsRaw: unknown[],
): GuestGender[] {
  const aptById = indexRowsById(apartmentsRaw);
  const roomById = indexRowsById(roomsRaw);
  const bedById = indexRowsById(bedsRaw);
  const out: GuestGender[] = [];

  for (const unit of units) {
    const g =
      resolveUnitGuestGender(unit, aptById, roomById, bedById, []) ??
      normalizeUnitGender(unit.genderType);
    if (g && !out.includes(g)) out.push(g);
  }

  return out;
}

/**
 * Inquiry genders for validation/submit: resolve from unit hierarchy first,
 * then fall back to stored unit labels (never stale request inquiry metadata).
 */
export function resolveInquiryGendersFromSelectedUnits(
  units: ReservationStoredUnitSnapshot[],
  bedsRaw: unknown[],
  roomsRaw: unknown[],
  apartmentsRaw: unknown[],
): GuestGender[] {
  const fromHierarchy = collectInquiryGendersFromUnits(
    units,
    bedsRaw,
    roomsRaw,
    apartmentsRaw,
  );
  if (fromHierarchy.length > 0) return fromHierarchy;

  const out: GuestGender[] = [];
  for (const unit of units) {
    const g = normalizeUnitGender(unit.genderType);
    if (g && !out.includes(g)) out.push(g);
  }
  return out;
}

/** Resolve unit gender: bed→room→apartment API chain, saved label, then single inquiry filter. */
export function resolveUnitGuestGender(
  unit: ReservationStoredUnitSnapshot,
  aptById: Map<string, Record<string, unknown>>,
  roomById: Map<string, Record<string, unknown>>,
  bedById: Map<string, Record<string, unknown>>,
  inquiryGenders: GuestGender[],
): GuestGender | undefined {
  const id = unit.id.toLowerCase();
  let bed: Record<string, unknown> | undefined;
  let room: Record<string, unknown> | undefined;
  let apt: Record<string, unknown> | undefined;

  if (unit.unitKind === "apartment") {
    apt = aptById.get(id);
  } else if (unit.unitKind === "room") {
    room = roomById.get(id);
    const aptId = room ? pickStr(room, "apartmentId", "ApartmentId") : "";
    apt = aptId ? aptById.get(aptId.toLowerCase()) : undefined;
  } else if (unit.unitKind === "bed") {
    bed = bedById.get(id);
    const roomId = bed ? pickStr(bed, "roomId", "RoomId") : "";
    room = roomId ? roomById.get(roomId.toLowerCase()) : undefined;
    const aptId = room ? pickStr(room, "apartmentId", "ApartmentId") : "";
    apt = aptId ? aptById.get(aptId.toLowerCase()) : undefined;
  }

  const label = mergeAvailabilityGenderFromRows(bed, room, apt);
  const fromChain = label ? normalizeUnitGender(label) : undefined;
  if (fromChain) return fromChain;

  const aptRow = apartmentRowForUnit(unit, aptById, roomById, bedById);
  const fromEnum = aptRow
    ? parseGuestGenderStrict(aptRow.gender ?? aptRow.Gender)
    : undefined;
  if (fromEnum) return fromEnum;

  const fromStored = normalizeUnitGender(unit.genderType);
  if (fromStored) return fromStored;

  if (inquiryGenders.length === 1) return inquiryGenders[0];
  return undefined;
}

/** Attach `genderType` label using API apartment Gender (authoritative on submit). */
export function enrichUnitsWithApartmentGender(
  units: ReservationStoredUnitSnapshot[],
  bedsRaw: unknown[],
  roomsRaw: unknown[],
  apartmentsRaw: unknown[],
  inquiryGenders: GuestGender[],
): ReservationStoredUnitSnapshot[] {
  const aptById = indexRowsById(apartmentsRaw);
  const roomById = indexRowsById(roomsRaw);
  const bedById = indexRowsById(bedsRaw);

  return units.map((unit) => {
    const g = resolveUnitGuestGender(
      unit,
      aptById,
      roomById,
      bedById,
      inquiryGenders,
    );
    if (!g) return unit;
    return { ...unit, genderType: GENDER_LABEL_AR[g] };
  });
}

/** Unwrap `{ data: list }` from availability server actions (same as companions). */
export function extractAvailabilityList(
  res: { data?: unknown; error?: string } | null | undefined,
): unknown[] {
  if (!res || (res as { error?: string }).error) return [];
  const data = (res as { data?: unknown }).data;
  if (data === undefined) return [];
  return getLookupArray(data);
}

export type ValidateReservationGuestsInput = {
  guests: { id: string; name: string; role: "applicant" | "companion" }[];
  getGuestGender: (guestId: string) => GuestGender | undefined;
  inquiryGenders: GuestGender[];
  units: ReservationStoredUnitSnapshot[];
  bedsRaw: unknown[];
  roomsRaw: unknown[];
  apartmentsRaw: unknown[];
};

export type ValidateReservationGuestsResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Ensures طالب الإقامة + every companion in the table match inquiry gender,
 * each unit's gender, and total bed capacity (rooms/apartments by bed count).
 */
export function validateReservationGuestsAgainstUnits(
  input: ValidateReservationGuestsInput,
): ValidateReservationGuestsResult {
  const { guests, getGuestGender, inquiryGenders, units } = input;

  if (units.length === 0) {
    return {
      ok: false,
      message:
        "لا توجد وحدات محفوظة من استعلام التوفر. احفظ الوحدات المختارة أولاً.",
    };
  }

  const selectedGuests = resolveGuestsForReservationValidation(guests);
  const hasApplicant = selectedGuests.some((g) => g.role === "applicant");
  if (!hasApplicant) {
    return {
      ok: false,
      message: "يجب تضمين طالب الإقامة في الطلب.",
    };
  }
  if (selectedGuests.length === 0) {
    return {
      ok: false,
      message: "يجب إضافة طالب الإقامة أو مرافق واحد على الأقل.",
    };
  }

  const guestGenders: { guest: (typeof guests)[0]; gender: GuestGender }[] = [];
  for (const guest of selectedGuests) {
    const gender = getGuestGender(guest.id);
    if (!gender) {
      const who =
        guest.role === "applicant" ? "طالب الإقامة" : guest.name || "مرافق";
      return {
        ok: false,
        message: `تعذر تحديد جنس ${who}. حدّث بيانات الحساب أو المرافقين.`,
      };
    }
    guestGenders.push({ guest, gender });
  }

  const aptIndex = indexRowsById(input.apartmentsRaw);
  const roomIndex = indexRowsById(input.roomsRaw);
  const bedIndex = indexRowsById(input.bedsRaw);

  const hasFixedGenderUnits = units.some((unit) =>
    isFixedApartmentAllocationForUnit(unit, aptIndex, roomIndex, bedIndex),
  );

  if (hasFixedGenderUnits && inquiryGenders.length > 0) {
    const inquirySet = new Set(inquiryGenders);
    for (const { guest, gender } of guestGenders) {
      if (!inquirySet.has(gender)) {
        const who =
          guest.role === "applicant" ? "طالب الإقامة" : guest.name;
        return {
          ok: false,
          message: `جنس ${who} (${GENDER_LABEL_AR[gender]}) لا يطابق الجنس المطلوب في استعلام التوفر (${inquiryGenders.map((g) => GENDER_LABEL_AR[g]).join("، ")}).`,
        };
      }
    }
  }

  const index = buildBedCapacityIndex(input.bedsRaw, input.roomsRaw);

  let totalCapacity = 0;
  for (const unit of units) {
    const cap = unitBedCapacity(unit, index);
    if (unit.unitKind !== "bed" && cap <= 0) {
      return {
        ok: false,
        message: `لا يمكن تحديد عدد الأسرة للوحدة «${unit.title}». جرّب إعادة استعلام التوفر وحفظ الاختيار.`,
      };
    }
    totalCapacity += cap;

    const enforceGender = isFixedApartmentAllocationForUnit(
      unit,
      aptIndex,
      roomIndex,
      bedIndex,
    );
    if (!enforceGender) continue;

    const unitGender =
      resolveUnitGuestGender(unit, aptIndex, roomIndex, bedIndex, inquiryGenders) ??
      normalizeUnitGender(unit.genderType);

    if (!unitGender) {
      return {
        ok: false,
        message: `تعذر تحديد جنس الوحدة «${unit.title}». أعد استعلام التوفر واحفظ الوحدات من جديد.`,
      };
    }

    for (const { guest, gender } of guestGenders) {
      if (gender !== unitGender) {
        const who =
          guest.role === "applicant" ? "طالب الإقامة" : guest.name;
        return {
          ok: false,
          message: `الوحدة «${unit.title}» مخصصة لـ${GENDER_LABEL_AR[unitGender]} ولا تتوافق مع جنس ${who} (${GENDER_LABEL_AR[gender]}).`,
        };
      }
    }
  }

  if (selectedGuests.length > totalCapacity) {
    const unitWord =
      units.length === 1 && units[0].unitKind === "bed"
        ? "سرير"
        : units.length === 1 && units[0].unitKind === "room"
          ? "غرفة"
          : "الوحدات المختارة";
    return {
      ok: false,
      message: `عدد الأشخاص المختارين (${selectedGuests.length}) أكبر من عدد الأسرة المتاحة في ${unitWord} (${totalCapacity}).`,
    };
  }

  return { ok: true };
}

/** @deprecated Use parseGuestGenderStrict */
export function guestGenderFromCompanionApi(
  gender: unknown,
): GuestGender | undefined {
  return parseGuestGenderStrict(gender);
}
