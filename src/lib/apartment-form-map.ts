import type { ApartmentFormValues } from "@/schemas";

export type ApartmentImageMeta = {
  id: string;
  path: string;
  isPrimary: boolean;
};

function boolFromAttachmentLike(item: unknown): boolean {
  if (!item || typeof item !== "object" || Array.isArray(item)) return false;
  const o = item as Record<string, unknown>;
  for (const k of ["isPrimary", "IsPrimary", "primary", "Primary"] as const) {
    const v = o[k];
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v === 1;
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (s === "true" || s === "1") return true;
      if (s === "false" || s === "0") return false;
    }
  }
  return false;
}

function idFromAttachmentLike(item: unknown): string {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    const o = item as Record<string, unknown>;
    for (const k of [
      "id",
      "Id",
      "unitImageId",
      "UnitImageId",
    ] as const) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number" && Number.isFinite(v)) return String(v);
    }
  }
  return "";
}

function pathFromAttachmentLike(item: unknown): string {
  if (typeof item === "string" && item.trim()) return item.trim();
  if (item && typeof item === "object" && !Array.isArray(item)) {
    const o = item as Record<string, unknown>;
    for (const k of [
      "path",
      "filePath",
      "url",
      "attachmentPath",
      "imageUrl",
      "Path",
      "FilePath",
      "Url",
      "AttachmentPath",
      "ImageUrl",
    ] as const) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return "";
}

/** Collect stored image paths from GET apartment payloads (strings or attachment-shaped objects). */
export function extractApartmentImagesFromApi(
  api: Record<string, unknown>,
): ApartmentImageMeta[] {
  const listKeys = [
    "images",
    "Images",
    "apartmentImages",
    "ApartmentImages",
    "imageUrls",
    "ImageUrls",
    "attachments",
    "Attachments",
  ];
  for (const key of listKeys) {
    const v = api[key];
    if (!Array.isArray(v) || v.length === 0) continue;
    const images = v
      .map((item) => ({
        id: idFromAttachmentLike(item),
        path: pathFromAttachmentLike(item),
        isPrimary: boolFromAttachmentLike(item),
      }))
      .filter((item) => item.path);
    if (images.length > 0) return images;
  }
  return [];
}

function pickStr(record: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = record[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

/** Map API enum / int / English name to lookup id string or Arabic label (form effects resolve labels). */
function normalizeEnumToFormValue(
  value: unknown,
  kind: "unitStatus" | "gender" | "allocationType",
): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value));
  const s = String(value).trim();
  if (/^\d+$/.test(s)) return s;

  const maps: Record<string, Record<string, string>> = {
    unitStatus: {
      Available: "1",
      Reserved: "2",
      Occupied: "3",
      AVAILABLE: "1",
      RESERVED: "2",
      OCCUPIED: "3",
      متاح: "متاح",
      محجوز: "محجوز",
      مشغول: "مشغول",
    },
    gender: {
      Male: "1",
      Female: "2",
      MALE: "1",
      FEMALE: "2",
      ذكر: "ذكر",
      أنثى: "أنثى",
      رجال: "رجال",
      سيدات: "سيدات",
    },
    allocationType: {
      Fixed: "1",
      Movable: "2",
      FIXED: "1",
      MOVABLE: "2",
      ثابت: "ثابت",
      متحرك: "متحرك",
      مرن: "مرن",
    },
  };

  return maps[kind][s] ?? s;
}

/**
 * Maps GET apartment payload → `ApartmentForm` defaults.
 * `ApartmentDto` exposes governorate/city/apartment type as Arabic names; form fields store ids or names and normalize via `useEffect`.
 */
export function mapApiApartmentToFormDefaults(
  api: Record<string, unknown>,
): Partial<ApartmentFormValues> & {
  id?: string;
  apartmentImageMeta?: ApartmentImageMeta[];
} {
  const id = pickStr(api, ["id", "Id"]);
  const priceRaw = api.price ?? api.Price;
  const price =
    typeof priceRaw === "number"
      ? priceRaw
      : typeof priceRaw === "string" && priceRaw.trim() !== ""
        ? Number(priceRaw)
        : NaN;

  const status = normalizeEnumToFormValue(api.status ?? api.Status, "unitStatus");
  const gender = normalizeEnumToFormValue(api.gender ?? api.Gender, "gender");
  const allocationType = normalizeEnumToFormValue(
    api.allocationType ?? api.AllocationType,
    "allocationType",
  );

  const apartmentTypeLabel = pickStr(api, [
    "apartmentTypeId",
    "ApartmentTypeId",
    "apartmentType",
    "ApartmentType",
  ]);
  const governorateLabel = pickStr(api, [
    "governorateId",
    "GovernorateId",
    "governorate",
    "Governorate",
  ]);
  const cityLabel = pickStr(api, ["cityId", "CityId", "city", "City"]);

  const isEdit = Boolean(id);
  const imageMeta = extractApartmentImagesFromApi(api);
  const imagePaths = imageMeta.map((item) => item.path);

  const base: Partial<ApartmentFormValues> & {
    id?: string;
    apartmentImageMeta?: ApartmentImageMeta[];
  } = {
    id,
    apartmentNumber: pickStr(api, ["apartmentNumber", "ApartmentNumber"]),
    description: pickStr(api, ["description", "Description"]),
    price: Number.isFinite(price) ? price : 0,
    status,
    gender,
    allocationType,
    street: pickStr(api, ["street", "Street"]),
    buildingNumber: pickStr(api, ["buildingNumber", "BuildingNumber"]),
    floor: pickStr(api, ["floor", "Floor"]),
    detailedAddress: pickStr(api, ["detailedAddress", "DetailedAddress"]),
    apartmentTypeId: apartmentTypeLabel,
    governorateId: governorateLabel,
    cityId: cityLabel,
    // Strings = server paths (shown via `getFullFileUrl`); placeholder satisfies zod when edit has no images.
    images: isEdit ? (imagePaths.length > 0 ? imagePaths : [""]) : [],
    apartmentImageMeta: imageMeta,
  };

  return base;
}
