"use client";

import { ColumnDef } from "@tanstack/react-table";

import CellAction from "@/components/settings/allocation-types/cell-action";
import { formatUtcToCairo } from "@/lib/date-timeOptions";

export type AllocationTypeColumn = {
  id: string;
  nameAr: string;
  nameEn: string;
  isDeleted?: boolean;
  createdBy?: string;
  modifiedBy?: string;
  createdAt?: string | null;
  modifiedAt?: string | null;
};

export function createColumns(showAuditColumns: boolean = false): ColumnDef<AllocationTypeColumn>[] {
  const base: ColumnDef<AllocationTypeColumn>[] = [
    { accessorKey: "nameAr", header: "الاسم العربي" },
    { accessorKey: "nameEn", header: "الاسم الإنجليزي" },
  ];

  const auditCols: ColumnDef<AllocationTypeColumn>[] = [
    {
      accessorKey: "isDeleted",
      header: "محذوف",
      cell: ({ row }) => {
        const isDeleted = Boolean(row.original.isDeleted);
        return (
          <span
            className={
              isDeleted
                ? "inline-flex items-center rounded px-2 py-1 text-xs font-semibold text-white bg-red-600"
                : "inline-flex items-center rounded px-2 py-1 text-xs font-semibold text-white bg-emerald-600"
            }
          >
            {isDeleted ? "نعم" : "لا"}
          </span>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "تاريخ الإنشاء",
      cell: ({ row }) => {
        const value = row.original.createdAt;
        return value ? formatUtcToCairo(value) : "-";
      },
    },
    { accessorKey: "createdBy", header: "المنشئ" },
    {
      accessorKey: "modifiedAt",
      header: "تاريخ التعديل",
      cell: ({ row }) => {
        const value = row.original.modifiedAt;
        return value ? formatUtcToCairo(value) : "-";
      },
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
