"use client";

import { ColumnDef } from "@tanstack/react-table";

import CellAction from "@/components/permissions/user/cell-action";
import { DateCell } from "@/components/ui/date-cell";

export type UserColumn = {
  id: string;
  userName: string;
  email: string;
  role: string;
  organizationId: string;
  createdAt: string;
  modifiedAt: string;
};

export const columns: ColumnDef<UserColumn>[] = [
  {
    accessorKey: "userName",
    header: "الاسم",
  },
  {
    accessorKey: "email",
    header: "الإيميل",
  },
  {
    accessorKey: "role",
    header: "الصلاحية",
  },
  {
    accessorKey: "createdAt",
    header: "تاريخ الإنشاء",
    cell: ({ row }) => {
      const dateValue =
        row.original.createdAt ||
        (row.original as any).created_at ||
        (row.original as any).CreatedAt ||
        (row.original as any).createdDate;
      return <DateCell dateValue={dateValue} />;
    },
  },
  {
    accessorKey: "modifiedAt",
    header: "تاريخ التعديل",
    cell: ({ row }) => {
      const dateValue =
        row.original.modifiedAt ||
        (row.original as any).modified_at ||
        (row.original as any).ModifiedAt ||
        (row.original as any).modifiedDate;
      return <DateCell dateValue={dateValue} />;
    },
  },
  {
    id: "actions",
    cell: ({ row }) => <CellAction data={row.original} />,
  },
];
