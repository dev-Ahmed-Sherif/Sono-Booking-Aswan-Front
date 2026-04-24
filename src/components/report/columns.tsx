"use client";

import { ColumnDef } from "@tanstack/react-table";

import CellAction from "@/components/report/cell-action";

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export type ComputerIssueColumn = {
  id: string;
  name: string;
  value: string;
  createdAt: string;
};

export const columns: ColumnDef<ComputerIssueColumn>[] = [
  {
    accessorKey: "description",
    header: "الوصف",
  },
  // {
  //   accessorKey: "createdAt",
  //   header: "تاريخ الإنشاء",
  // },
  // {
  //   accessorKey: "createdAt",
  //   header: "تاريخ التعديل",
  // },
  {
    id: "actions",
    cell: ({ row }) => <CellAction data={row.original} />,
  },
];
