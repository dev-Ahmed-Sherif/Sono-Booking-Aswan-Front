"use client";

import { ColumnDef } from "@tanstack/react-table";
import CellAction from "@/components/bed/cell-action";
import { localizeUnitStatus, toArabicDigits } from "@/lib/unit-format";

export type BedColumn = {
  id: string;
  bedNumber: string;
  dimensions: string;
  status: string;
};

export const columns: ColumnDef<BedColumn>[] = [
  {
    accessorKey: "bedNumber",
    header: "رقم السرير",
    cell: ({ row }) => toArabicDigits(row.original.bedNumber),
  },
  {
    accessorKey: "dimensions",
    header: "الأبعاد",
    cell: ({ row }) => toArabicDigits(row.original.dimensions),
  },
  {
    accessorKey: "status",
    header: "الحالة",
    cell: ({ row }) => localizeUnitStatus(row.original.status),
  },
  { id: "actions", cell: ({ row }) => <CellAction data={row.original} /> },
];
