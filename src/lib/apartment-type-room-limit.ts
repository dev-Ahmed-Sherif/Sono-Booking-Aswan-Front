export type ApartmentTypeOption = {
  id: string;
  nameAr: string;
  nameEn?: string;
};

export type ApartmentRoomLimit = {
  maxRooms: number | null;
  typeLabel: string;
};

function pickApartmentField(
  api: Record<string, unknown>,
  keys: string[],
): string {
  for (const key of keys) {
    const value = api[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function parsePositiveInt(value: string): number | null {
  const normalized = value.replace(/[٠-٩]/g, (digit) =>
    String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)),
  );
  const count = Number.parseInt(normalized, 10);
  return Number.isFinite(count) && count > 0 ? count : null;
}

/**
 * Resolves the English apartment type label from an id, Arabic name, or raw API value.
 */
export function resolveApartmentTypeNameEn(
  apartmentTypeRef: string | null | undefined,
  options: ApartmentTypeOption[],
): string | undefined {
  const ref = String(apartmentTypeRef ?? "").trim();
  if (!ref) return undefined;

  const byId = options.find((option) => option.id === ref);
  if (byId?.nameEn?.trim()) return byId.nameEn.trim();
  if (byId?.nameAr?.trim()) return byId.nameAr.trim();

  const byNameEn = options.find(
    (option) =>
      option.nameEn?.trim().toLowerCase() === ref.toLowerCase(),
  );
  if (byNameEn?.nameEn?.trim()) return byNameEn.nameEn.trim();
  if (byNameEn?.nameAr?.trim()) return byNameEn.nameAr.trim();

  const byNameAr = options.find((option) => option.nameAr === ref);
  if (byNameAr?.nameEn?.trim()) return byNameAr.nameEn.trim();
  if (byNameAr?.nameAr?.trim()) return byNameAr.nameAr.trim();

  return ref;
}

/**
 * Derives the maximum number of rooms allowed for an apartment type from its English name.
 * - "Studio" → 1
 * - "Rooms 2", "Rooms 3", "Rooms 4", … → parsed count
 */
export function getMaxRoomsFromApartmentTypeNameEn(
  nameEn: string | null | undefined,
): number | null {
  const trimmed = String(nameEn ?? "").trim();
  if (!trimmed) return null;

  if (/\bstudio\b/i.test(trimmed)) return 1;

  const exactPatterns = [
    /^rooms?\s+(\d+)$/i,
    /^room\s+(\d+)$/i,
    /^(\d+)\s+rooms?$/i,
  ];
  for (const pattern of exactPatterns) {
    const match = pattern.exec(trimmed);
    if (match) {
      const count = parsePositiveInt(match[1]);
      if (count != null) return count;
    }
  }

  const embeddedMatch = /\brooms?\s*(\d+)\b/i.exec(trimmed);
  if (embeddedMatch) {
    const count = parsePositiveInt(embeddedMatch[1]);
    if (count != null) return count;
  }

  return null;
}

/** Parses English or Arabic apartment type labels into a max room count. */
export function getMaxRoomsFromApartmentTypeLabel(
  label: string | null | undefined,
): number | null {
  const trimmed = String(label ?? "").trim();
  if (!trimmed) return null;

  const fromEnglish = getMaxRoomsFromApartmentTypeNameEn(trimmed);
  if (fromEnglish != null) return fromEnglish;

  if (/^(استوديو|ستوديو)$/i.test(trimmed) || /استوديو|ستوديو/.test(trimmed)) {
    return 1;
  }

  if (/غرفتين/.test(trimmed)) return 2;
  if (/غرفة\s*واحدة|غرفه\s*واحده|غرفة\s*واحده/.test(trimmed)) return 1;

  const arRoomsPrefix = /^(?:غرف|غرفة)\s*([0-9٠-٩]+)$/i.exec(trimmed);
  if (arRoomsPrefix) return parsePositiveInt(arRoomsPrefix[1]);

  const arRoomsSuffix = /^([0-9٠-٩]+)\s*(?:غرف|غرفة)$/i.exec(trimmed);
  if (arRoomsSuffix) return parsePositiveInt(arRoomsSuffix[1]);

  const arEmbedded = /(?:غرف|غرفة)\s*([0-9٠-٩]+)/i.exec(trimmed);
  if (arEmbedded) return parsePositiveInt(arEmbedded[1]);

  const arLeadingNumber = /^([0-9٠-٩]+)/.exec(trimmed);
  if (arLeadingNumber && /غرف|غرفة/.test(trimmed)) {
    return parsePositiveInt(arLeadingNumber[1]);
  }

  return null;
}

function findMatchingApartmentTypeOption(
  ref: string,
  options: ApartmentTypeOption[],
): ApartmentTypeOption | undefined {
  const normalized = ref.trim().toLowerCase();
  if (!normalized) return undefined;

  return options.find(
    (option) =>
      option.id === ref ||
      option.nameAr === ref ||
      option.nameEn?.trim().toLowerCase() === normalized,
  );
}

function collectApartmentTypeRefs(
  apartment: Record<string, unknown>,
): string[] {
  const refs: string[] = [];
  const nestedType = apartment.apartmentType ?? apartment.ApartmentType;
  if (nestedType && typeof nestedType === "object" && !Array.isArray(nestedType)) {
    const nested = nestedType as Record<string, unknown>;
    for (const key of [
      "nameEn",
      "NameEn",
      "nameAr",
      "NameAr",
      "code",
      "Code",
      "id",
      "Id",
    ]) {
      const value = nested[key];
      if (value == null) continue;
      const text = String(value).trim();
      if (text) refs.push(text);
    }
  }

  const typeId = pickApartmentField(apartment, [
    "apartmentTypeId",
    "ApartmentTypeId",
  ]);
  const typeNameRaw = apartment.apartmentType ?? apartment.ApartmentType;
  const typeName =
    typeof typeNameRaw === "string" ? typeNameRaw.trim() : "";
  const typeNameEn = pickApartmentField(apartment, [
    "apartmentTypeNameEn",
    "ApartmentTypeNameEn",
    "apartmentTypeEn",
    "ApartmentTypeEn",
  ]);

  refs.push(typeNameEn, typeId, typeName);
  return refs.filter(Boolean);
}

/** Resolves max rooms from apartment API payload and apartment-type lookup options. */
export function resolveApartmentRoomLimit(
  apartment: Record<string, unknown> | null | undefined,
  options: ApartmentTypeOption[],
): ApartmentRoomLimit {
  if (!apartment || typeof apartment !== "object") {
    return { maxRooms: null, typeLabel: "" };
  }

  const refs = collectApartmentTypeRefs(apartment);
  const typeNameEn = pickApartmentField(apartment, [
    "apartmentTypeNameEn",
    "ApartmentTypeNameEn",
    "apartmentTypeEn",
    "ApartmentTypeEn",
  ]);
  const typeNameRaw = apartment.apartmentType ?? apartment.ApartmentType;
  const typeName =
    typeof typeNameRaw === "string" ? typeNameRaw.trim() : "";
  const typeId = pickApartmentField(apartment, [
    "apartmentTypeId",
    "ApartmentTypeId",
  ]);
  const seen = new Set<string>();

  for (const ref of refs) {
    if (seen.has(ref)) continue;
    seen.add(ref);

    const resolved = resolveApartmentTypeNameEn(ref, options) ?? ref;
    const maxRooms = getMaxRoomsFromApartmentTypeLabel(resolved);
    if (maxRooms != null) {
      return { maxRooms, typeLabel: resolved };
    }
  }

  for (const ref of refs) {
    const matched = findMatchingApartmentTypeOption(ref, options);
    if (!matched) continue;

    const labels = [matched.nameEn, matched.nameAr].filter(Boolean) as string[];
    for (const label of labels) {
      const maxRooms = getMaxRoomsFromApartmentTypeLabel(label);
      if (maxRooms != null) {
        return { maxRooms, typeLabel: matched.nameEn?.trim() || matched.nameAr };
      }
    }
  }

  return { maxRooms: null, typeLabel: typeNameEn || typeName || typeId };
}

export function formatApartmentTypeRoomLimitMessage(
  maxRooms: number,
  currentCount: number,
): string {
  const roomWord = maxRooms === 1 ? "غرفة واحدة" : `${maxRooms} غرف`;
  return `الحد الأقصى ${roomWord} فقط (${currentCount}/${maxRooms})`;
}

export function countRoomRows(list: unknown[]): number {
  return list.filter((item) => {
    if (item == null || typeof item !== "object") return false;
    const row = item as Record<string, unknown>;
    const id = String(row.id ?? row.Id ?? "").trim();
    if (!id) return false;

    const apartmentRef = String(
      row.apartmentId ?? row.ApartmentId ?? "",
    ).trim();
    if (apartmentRef) return true;

    const roomNumber = row.roomNumber ?? row.RoomNumber;
    if (roomNumber == null || String(roomNumber).trim() === "") return true;
    const parsed = Number(roomNumber);
    return Number.isFinite(parsed) ? parsed > 0 : true;
  }).length;
}

export async function countRoomsForApartment(
  apartmentId: string,
  getRooms: (
    apartmentId?: string,
    options?: { allStatuses?: boolean },
  ) => Promise<unknown>,
): Promise<number | null> {
  const trimmed = apartmentId.trim();
  if (!trimmed) return null;

  const result = await getRooms(trimmed, { allStatuses: true });
  if ((result as { error?: string })?.error) return null;

  const raw = (result as { data?: unknown }).data ?? result;
  const list = Array.isArray(raw) ? raw : [];
  return countRoomRows(list);
}

export type RoomAddLimitCheck = {
  allowed: boolean;
  currentCount: number;
  maxRooms: number | null;
  typeLabel: string;
};

/** Validates whether another room can be added to an apartment. */
export async function checkApartmentRoomAddLimit(
  apartmentId: string,
  apartment: Record<string, unknown> | null | undefined,
  options: ApartmentTypeOption[],
  getRooms: (
    apartmentId?: string,
    options?: { allStatuses?: boolean },
  ) => Promise<unknown>,
  fallbackTypeRef?: string | null,
  localFallbackCount = 0,
): Promise<RoomAddLimitCheck> {
  const trimmedApartmentId = apartmentId.trim();
  let limit = resolveApartmentRoomLimit(apartment, options);
  if (limit.maxRooms == null) {
    const typeRef = String(fallbackTypeRef ?? "").trim();
    if (typeRef) {
      limit = resolveApartmentRoomLimit(
        { apartmentTypeId: typeRef },
        options,
      );
    }
  }

  if (!trimmedApartmentId) {
    return {
      allowed: limit.maxRooms == null,
      currentCount: 0,
      maxRooms: limit.maxRooms,
      typeLabel: limit.typeLabel,
    };
  }

  const remoteCount = await countRoomsForApartment(trimmedApartmentId, getRooms);
  const currentCount = remoteCount ?? localFallbackCount;
  const allowed =
    limit.maxRooms == null ? true : currentCount < limit.maxRooms;

  return {
    allowed,
    currentCount,
    maxRooms: limit.maxRooms,
    typeLabel: limit.typeLabel,
  };
}
