"use client";

import { ColumnDef } from "@tanstack/react-table";
import CellAction from "@/components/services/license-tourist-marina/cell-action";
import { formatUtcToCairo } from "@/lib/date-timeOptions";

export type LicenseTouristMarinaColumn = {
  id: string;
  licenseNumber: string;
  licenseDate?: string | null;
  /** Read DTO: `Text` (often serialized as `text`). */
  text?: string | null;
  Text?: string | null;
  fromOrganizationNameAr?: string;
  toOrganizationNameAr?: string;
  status?: string;
  touristMarinaNumber: number;
  isDeleted?: boolean;
  createdAt: string;
  modifiedAt?: string;
  createdBy?: string;
  modifiedBy?: string;
};

export function createColumns(
  showAuditColumns: boolean = false,
): ColumnDef<LicenseTouristMarinaColumn>[] {
  const base: ColumnDef<LicenseTouristMarinaColumn>[] = [
    { accessorKey: "licenseNumber", header: "رقم الترخيص" },
    {
      accessorKey: "fromOrganizationNameAr",
      header: "الجهة المرسلة",
      cell: ({ row }) => row.original.fromOrganizationNameAr || "-",
    },
    {
      accessorKey: "toOrganizationNameAr",
      header: "الجهة المستلمة",
      cell: ({ row }) => row.original.toOrganizationNameAr || "-",
    },
    {
      accessorKey: "touristMarinaNumber",
      header: "عدد المراسي السياحية",
    },
    {
      accessorKey: "status",
      header: "الحالة",
      cell: ({ row }) => {
        const statusMap: Record<string, { label: string; className: string }> =
          {
            pending: {
              label: "جارى المراجعة",
              className: "bg-yellow-100 text-yellow-800",
            },
            needcompelete: {
              label: "مطلوب الإستكمال",
              className: "bg-orange-100 text-orange-800",
            },
            approved: {
              label: "مقبول",
              className: "bg-green-100  text-green-800",
            },
          };
        const key = (row.original.status ?? "").toLowerCase();
        const entry = statusMap[key];
        if (!entry) return row.original.status || "-";
        return (
          <span
            className={`inline-block rounded-full px-6 py-1 text-sm font-bold ${entry.className}`}
          >
            {entry.label}
          </span>
        );
      },
    },
    {
      accessorKey: "licenseDate",
      header: "تاريخ الترخيص",
      cell: ({ row }) =>
        row.original.licenseDate
          ? formatUtcToCairo(row.original.licenseDate)
          : "-",
    },
    {
      id: "licenseNote",
      header: "ملاحظات",
      cell: ({ row }) => {
        const raw = row.original.text ?? row.original.Text ?? "";
        const t = typeof raw === "string" ? raw.trim() : "";
        if (!t) return "-";
        return t.length > 48 ? `${t.slice(0, 48)}…` : t;
      },
    },
  ];

  const auditCols: ColumnDef<LicenseTouristMarinaColumn>[] = [
    {
      accessorKey: "createdAt",
      header: "تاريخ الإنشاء",
      cell: ({ row }) => formatUtcToCairo(row.original.createdAt),
    },
    { accessorKey: "createdBy", header: "المنشئ" },
    {
      accessorKey: "modifiedAt",
      header: "تاريخ التعديل",
      cell: ({ row }) =>
        row.original.modifiedAt
          ? formatUtcToCairo(row.original.modifiedAt)
          : "-",
    },
    { accessorKey: "modifiedBy", header: "المعدل بواسطة" },
  ];

  return [
    ...base,
    ...(showAuditColumns ? auditCols : []),
    { id: "actions", cell: ({ row }) => <CellAction data={row.original} /> },
  ];
}

export const columns = createColumns();
