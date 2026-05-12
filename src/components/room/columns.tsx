"use client";

import { ColumnDef } from "@tanstack/react-table";
import CellAction from "@/components/room/cell-action";
import { localizeUnitStatus, toArabicDigits } from "@/lib/unit-format";

export type RoomColumn = {
  id: string;
  roomNumber: string;
  bedsCount: number;
  status: string;
};

export const columns: ColumnDef<RoomColumn>[] = [
  {
    accessorKey: "roomNumber",
    header: "رقم الغرفة",
    cell: ({ row }) => toArabicDigits(row.original.roomNumber),
  },
  {
    accessorKey: "bedsCount",
    header: "عدد الأسرة",
    cell: ({ row }) => toArabicDigits(row.original.bedsCount),
  },
  {
    accessorKey: "status",
    header: "الحالة",
    cell: ({ row }) => localizeUnitStatus(row.original.status),
  },
  { id: "actions", cell: ({ row }) => <CellAction data={row.original} /> },
];
