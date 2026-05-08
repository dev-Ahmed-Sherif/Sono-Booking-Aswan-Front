"use client";

import { ColumnDef } from "@tanstack/react-table";
import CellAction from "@/components/bed/cell-action";

export type BedColumn = {
  id: string;
  bedNumber: string;
  dimensions: string;
  status: string;
};

export const columns: ColumnDef<BedColumn>[] = [
  { accessorKey: "bedNumber", header: "رقم السرير" },
  { accessorKey: "dimensions", header: "الأبعاد" },
  { accessorKey: "status", header: "الحالة" },
  { id: "actions", cell: ({ row }) => <CellAction data={row.original} /> },
];
