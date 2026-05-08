"use client";

import { ColumnDef } from "@tanstack/react-table";

import CellAction from "@/components/settings/payment-methods/cell-action";
import { formatUtcToCairo } from "@/lib/date-timeOptions";

export type PaymentMethodColumn = {
  id: string;
  nameAr: string;
  nameEn: string;
  isDeleted?: boolean;
  createdBy?: string;
  modifiedBy?: string;
  createdAt?: string | null;
  modifiedAt?: string | null;
};

export function createColumns(showAuditColumns: boolean = false): ColumnDef<PaymentMethodColumn>[] {
  const base: ColumnDef<PaymentMethodColumn>[] = [
    { accessorKey: "nameAr", header: "الاسم العربي" },
    { accessorKey: "nameEn", header: "الاسم الإنجليزي" },
  ];

  const auditCols: ColumnDef<PaymentMethodColumn>[] = [
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
