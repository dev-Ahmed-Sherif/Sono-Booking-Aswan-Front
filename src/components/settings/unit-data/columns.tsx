"use client";

import { ColumnDef } from "@tanstack/react-table";

import CellAction from "@/components/settings/unit-data/cell-action";
import { formatUtcToCairo } from "@/lib/date-timeOptions";
import { toArabicDigits } from "@/lib/unit-format";

/** Mirrors `ApartmentDto` for table rows (camelCase JSON + optional PascalCase from API). Address fields (Street–DetailedAddress) are not shown in columns per product rule. */
export type ApartmentColumn = {
  id: string;
  apartmentNumber?: string;
  ApartmentNumber?: string;
  description?: string;
  Description?: string;
  price?: number;
  Price?: number;
  status?: number | string;
  Status?: number | string;
  gender?: number | string;
  Gender?: number | string;
  allocationType?: number | string;
  AllocationType?: number | string;
  apartmentType?: string;
  ApartmentType?: string;
  apartmentTypeId?: string;
  ApartmentTypeId?: string;
  governorate?: string;
  Governorate?: string;
  governorateId?: string;
  GovernorateId?: string;
  city?: string;
  City?: string;
  cityId?: string;
  CityId?: string;
  isDeleted?: boolean;
  IsDeleted?: boolean;
  createdAt?: string | null;
  CreatedAt?: string | null;
  createdBy?: string;
  CreatedBy?: string;
  modifiedAt?: string | null;
  ModifiedAt?: string | null;
  modifiedBy?: string;
  ModifiedBy?: string;
  roomsCount?: number;
  RoomsCount?: number;
  bedsCount?: number;
  BedsCount?: number;
};

function rowRecord(row: ApartmentColumn): Record<string, unknown> {
  return row as Record<string, unknown>;
}

function pick<T>(row: ApartmentColumn, keys: string[]): T | undefined {
  const r = rowRecord(row);
  for (const k of keys) {
    const v = r[k];
    if (v !== undefined && v !== null && v !== "") return v as T;
  }
  return undefined;
}

/** Prefer Arabic/display labels from API; fall back to ids if needed. */
function pickDisplayLabel(row: ApartmentColumn, keys: string[]): string {
  const v = pick<string>(row, keys);
  if (v === undefined || v === null) return "-";
  const s = String(v).trim();
  return s || "-";
}

/** `SonoBooking.Domain.UnitStatus` → Arabic (Values attribute). */
function formatUnitStatusAr(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  const num =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value.trim())
        ? Number(value.trim())
        : null;
  const byNum: Record<number, string> = {
    1: "متاح",
    2: "محجوز",
    3: "مشغول",
  };
  if (num !== null && byNum[num]) return byNum[num];

  const key = String(value).trim();
  const byName: Record<string, string> = {
    Available: "متاح",
    AVAILABLE: "متاح",
    Reserved: "محجوز",
    RESERVED: "محجوز",
    Occupied: "مشغول",
    OCCUPIED: "مشغول",
    "1": "متاح",
    "2": "محجوز",
    "3": "مشغول",
  };
  return byName[key] ?? key;
}

/** `SonoBooking.Domain.Gender` → Arabic. */
function formatGenderAr(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  const num =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value.trim())
        ? Number(value.trim())
        : null;
  const byNum: Record<number, string> = {
    1: "ذكر",
    2: "أنثى",
  };
  if (num !== null && byNum[num]) return byNum[num];

  const key = String(value).trim();
  const byName: Record<string, string> = {
    Male: "ذكر",
    MALE: "ذكر",
    Female: "أنثى",
    FEMALE: "أنثى",
    "1": "ذكر",
    "2": "أنثى",
  };
  return byName[key] ?? key;
}

/** `SonoBooking.Domain.AllocationType` → Arabic. */
function formatAllocationTypeAr(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  const num =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value.trim())
        ? Number(value.trim())
        : null;
  const byNum: Record<number, string> = {
    1: "ثابت",
    2: "متحرك",
  };
  if (num !== null && byNum[num]) return byNum[num];

  const key = String(value).trim();
  const byName: Record<string, string> = {
    Fixed: "ثابت",
    FIXED: "ثابت",
    Movable: "متحرك",
    MOVABLE: "متحرك",
    "1": "ثابت",
    "2": "متحرك",
  };
  return byName[key] ?? key;
}

function formatPrice(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString("ar-EG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function truncateText(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}

function formatCount(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? toArabicDigits(n) : "-";
}

/** Audit columns are included here; `DataTable` hides them for users who are not Super Admin. */
export function createColumns(): ColumnDef<ApartmentColumn>[] {
  const base: ColumnDef<ApartmentColumn>[] = [
    {
      id: "apartmentNumber",
      accessorFn: (row) =>
        String(pick<string>(row, ["apartmentNumber", "ApartmentNumber"]) ?? ""),
      header: "رقم الشقة",
      cell: ({ row }) =>
        String(
          pick<string>(row.original, ["apartmentNumber", "ApartmentNumber"]) ??
            "",
        ),
    },
    {
      id: "roomsCount",
      accessorFn: (row) =>
        pick<number>(row, ["roomsCount", "RoomsCount"]) ?? 0,
      header: "عدد الغرف",
      cell: ({ row }) =>
        formatCount(pick(row.original, ["roomsCount", "RoomsCount"])),
    },
    {
      id: "bedsCount",
      accessorFn: (row) => pick<number>(row, ["bedsCount", "BedsCount"]) ?? 0,
      header: "عدد الأسرة",
      cell: ({ row }) =>
        formatCount(pick(row.original, ["bedsCount", "BedsCount"])),
    },
    {
      accessorKey: "description",
      header: "الوصف",
      cell: ({ row }) => {
        const raw = pick<string>(row.original, ["description", "Description"]);
        return raw ? truncateText(raw, 80) : "-";
      },
    },
    {
      accessorKey: "price",
      header: "السعر",
      cell: ({ row }) => formatPrice(pick(row.original, ["price", "Price"])),
    },
    {
      accessorKey: "status",
      header: "الحالة",
      cell: ({ row }) =>
        formatUnitStatusAr(pick(row.original, ["status", "Status"])),
    },
    {
      accessorKey: "gender",
      header: "النوع",
      cell: ({ row }) =>
        formatGenderAr(pick(row.original, ["gender", "Gender"])),
    },
    {
      accessorKey: "allocationType",
      header: "نوع التخصيص",
      cell: ({ row }) =>
        formatAllocationTypeAr(
          pick(row.original, ["allocationType", "AllocationType"]),
        ),
    },
    {
      id: "apartmentType",
      accessorFn: (row) =>
        pickDisplayLabel(row, [
          "apartmentType",
          "ApartmentType",
          "apartmentTypeId",
          "ApartmentTypeId",
        ]),
      header: "نوع الشقة",
      cell: ({ row }) =>
        pickDisplayLabel(row.original, [
          "apartmentType",
          "ApartmentType",
          "apartmentTypeId",
          "ApartmentTypeId",
        ]),
    },
    {
      id: "governorate",
      accessorFn: (row) =>
        pickDisplayLabel(row, [
          "governorate",
          "Governorate",
          "governorateId",
          "GovernorateId",
        ]),
      header: "المحافظة",
      cell: ({ row }) =>
        pickDisplayLabel(row.original, [
          "governorate",
          "Governorate",
          "governorateId",
          "GovernorateId",
        ]),
    },
    {
      id: "city",
      accessorFn: (row) =>
        pickDisplayLabel(row, ["city", "City", "cityId", "CityId"]),
      header: "المدينة",
      cell: ({ row }) =>
        pickDisplayLabel(row.original, ["city", "City", "cityId", "CityId"]),
    },
  ];

  const auditCols: ColumnDef<ApartmentColumn>[] = [
    {
      accessorKey: "createdAt",
      header: "تاريخ الإنشاء",
      cell: ({ row }) => {
        const value = pick<string | null>(row.original, [
          "createdAt",
          "CreatedAt",
        ]);
        return value ? formatUtcToCairo(value) : "-";
      },
    },
    { accessorKey: "createdBy", header: "المنشئ" },
    {
      accessorKey: "modifiedAt",
      header: "تاريخ التعديل",
      cell: ({ row }) => {
        const value = pick<string | null>(row.original, [
          "modifiedAt",
          "ModifiedAt",
        ]);
        return value ? formatUtcToCairo(value) : "-";
      },
    },
    { accessorKey: "modifiedBy", header: "المعدل بواسطة" },
  ];

  return [
    ...base,
    ...auditCols,
    { id: "actions", cell: ({ row }) => <CellAction data={row.original} /> },
  ];
}

export const columns = createColumns();
