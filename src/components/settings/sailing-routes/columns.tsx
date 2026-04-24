"use client";

import { ColumnDef } from "@tanstack/react-table";

import CellAction from "@/components/settings/sailing-routes/cell-action";

import { formatUtcToCairo } from "@/lib/date-timeOptions";

export type SailingRouteColumn = {
  id: string;
  nameAr: string;
  nameEn: string;
  isDeleted?: boolean;
  createdBy?: string;
  modifiedBy?: string;
  createdAt: string;
  modifiedAt: string;
};

export function createColumns(
  showAuditColumns: boolean = false,
): ColumnDef<SailingRouteColumn>[] {
  const base: ColumnDef<SailingRouteColumn>[] = [
    { accessorKey: "nameAr", header: "الاسم العربي" },
    { accessorKey: "nameEn", header: "الاسم الإنجليزي" },
  ];

  const auditCols: ColumnDef<SailingRouteColumn>[] = [
    {
      accessorKey: "createdAt",
      header: "تاريخ الإنشاء",
      cell: ({ row }) => formatUtcToCairo(row.original.createdAt),
    },
    { accessorKey: "createdBy", header: "المنشئ" },
    {
      accessorKey: "modifiedAt",
      header: "تاريخ التعديل",
      cell: ({ row }) => formatUtcToCairo(row.original.modifiedAt),
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
