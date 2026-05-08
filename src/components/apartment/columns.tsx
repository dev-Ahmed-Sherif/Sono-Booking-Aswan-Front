"use client";

import { ColumnDef } from "@tanstack/react-table";
import CellAction from "@/components/apartment/cell-action";

export type ApartmentColumn = {
  id: string;
  apartmentNumber: string;
  roomsCount: number;
  status: string;
  allocation: string;
  allocationType: string;
};

export const columns: ColumnDef<ApartmentColumn>[] = [
  { accessorKey: "apartmentNumber", header: "رقم الشقة" },
  { accessorKey: "roomsCount", header: "عدد الغرف" },
  { accessorKey: "status", header: "الحالة" },
  { accessorKey: "allocation", header: "التخصيص" },
  { accessorKey: "allocationType", header: "نوع التخصيص" },
  { id: "actions", cell: ({ row }) => <CellAction data={row.original} /> },
];
