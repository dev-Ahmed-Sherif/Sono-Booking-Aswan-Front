"use client";

import { ColumnDef } from "@tanstack/react-table";
import CellAction from "@/components/room/cell-action";

export type RoomColumn = {
  id: string;
  roomNumber: string;
  bedsCount: number;
  status: string;
};

export const columns: ColumnDef<RoomColumn>[] = [
  { accessorKey: "roomNumber", header: "رقم الغرفة" },
  { accessorKey: "bedsCount", header: "عدد الأسرة" },
  { accessorKey: "status", header: "الحالة" },
  { id: "actions", cell: ({ row }) => <CellAction data={row.original} /> },
];
