"use client";

import { ColumnDef } from "@tanstack/react-table";

import CellAction from "@/components/settings/allowed-day-before-reservations/cell-action";
import { formatUtcToCairo } from "@/lib/date-timeOptions";

export type AllowedDayBeforeReservationColumn = {
  id: string;
  nameAr: string;
  nameEn: string;
  numofDays: number;
  isDeleted?: boolean;
  createdBy?: string;
  modifiedBy?: string;
  createdAt?: string | null;
  modifiedAt?: string | null;
};

export function createColumns(showAuditColumns: boolean = false): ColumnDef<AllowedDayBeforeReservationColumn>[] {
  const base: ColumnDef<AllowedDayBeforeReservationColumn>[] = [
    { accessorKey: "nameAr", header: "الاسم العربي" },
    { accessorKey: "nameEn", header: "الاسم الإنجليزي" },
    { accessorKey: "numofDays", header: "عدد الأيام" },
  ];

  const auditCols: ColumnDef<AllowedDayBeforeReservationColumn>[] = [
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
