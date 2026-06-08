import type { BedFormValues } from "@/schemas";

export type BedImageMeta = {
  id: string;
  attachmentId: string;
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
    for (const k of ["id", "Id", "unitImageId", "UnitImageId"] as const) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number" && Number.isFinite(v)) return String(v);
    }
  }
  return "";
}

function attachmentIdFromAttachmentLike(item: unknown): string {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    const o = item as Record<string, unknown>;
    for (const k of [
      "attachmentId",
      "AttachmentId",
      "attachId",
      "AttachId",
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

export function extractBedImagesFromApi(
  api: Record<string, unknown>,
): BedImageMeta[] {
  const listKeys = [
    "images",
    "Images",
    "bedImages",
    "BedImages",
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
        attachmentId: attachmentIdFromAttachmentLike(item),
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
    if (v !== undefined && v !== null && String(v).trim() !== "")
      return String(v).trim();
  }
  return "";
}

function normalizeUnitStatus(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && Number.isFinite(value))
    return String(Math.trunc(value));
  const s = String(value).trim();
  if (/^\d+$/.test(s)) return s;
  const map: Record<string, string> = {
    Available: "1",
    Reserved: "2",
    Occupied: "3",
    AVAILABLE: "1",
    RESERVED: "2",
    OCCUPIED: "3",
    متاح: "1",
    محجوز: "2",
    مشغول: "3",
    متاحة: "1",
    محجوزة: "2",
    مشغولة: "3",
  };
  return map[s] ?? s;
}

export function mapApiBedToFormDefaults(
  api: Record<string, unknown>,
): Partial<BedFormValues> & {
  id?: string;
  bedImageMeta?: BedImageMeta[];
} {
  const id = pickStr(api, ["id", "Id"]);
  const priceRaw = api.price ?? api.Price;
  const price =
    typeof priceRaw === "number"
      ? priceRaw
      : typeof priceRaw === "string" && priceRaw.trim() !== ""
        ? Number(priceRaw)
        : NaN;

  const status = normalizeUnitStatus(api.status ?? api.Status);
  const roomId = pickStr(api, ["roomId", "RoomId", "room", "Room"]);

  const isEdit = Boolean(id);
  const imageMeta = extractBedImagesFromApi(api);
  const imagePaths = imageMeta.map((item) => item.path);

  const base: Partial<BedFormValues> & {
    id?: string;
    bedImageMeta?: BedImageMeta[];
  } = {
    id,
    bedNumber: Number(pickStr(api, ["bedNumber", "BedNumber"])) || undefined,
    description: pickStr(api, ["description", "Description"]),
    dimensions: pickStr(api, ["dimensions", "Dimensions"]),
    price: Number.isFinite(price) ? price : 0,
    status,
    roomId,
    images: isEdit ? (imagePaths.length > 0 ? imagePaths : [""]) : [],
    bedImageMeta: imageMeta,
  };

  return base;
}
