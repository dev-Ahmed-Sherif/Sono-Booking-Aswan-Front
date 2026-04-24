"use client";

import { ColumnDef } from "@tanstack/react-table";

import CellAction from "@/components/permissions/role/cell-action";
import { DateCell } from "@/components/ui/date-cell";

export type RoleColumn = {
  id: string;
  nameAr: string;
  nameEn: string;
  isDeleted?: boolean;
  createdAt: string;
  modifiedAt: string;
};

export function createColumns(
  showAuditColumns: boolean = false,
): ColumnDef<RoleColumn>[] {
  const base: ColumnDef<RoleColumn>[] = [
    {
      accessorKey: "nameAr",
      header: "الاسم العربي",
    },
    {
      accessorKey: "nameEn",
      header: "الاسم الإنجليزي",
    },
  ];

  const auditCols: ColumnDef<RoleColumn>[] = [
    {
      accessorKey: "createdAt",
      header: "تاريخ الإنشاء",
      cell: ({ row }) => {
        return <DateCell dateValue={row.original.createdAt} />;
      },
    },
    {
      accessorKey: "modifiedAt",
      header: "تاريخ التعديل",
      cell: ({ row }) => {
        return <DateCell dateValue={row.original.modifiedAt} />;
      },
    },
  ];

  return [
    ...base,
    ...(showAuditColumns ? auditCols : []),
    {
      id: "actions",
      cell: ({ row }) => <CellAction data={row.original} />,
    },
  ];
}

export const columns = createColumns();
