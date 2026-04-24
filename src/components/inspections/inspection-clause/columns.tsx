"use client";

import { ColumnDef } from "@tanstack/react-table";

import CellAction from "@/components/inspections/inspection-clause/cell-action";
import { formatUtcToCairo } from "@/lib/date-timeOptions";

export type InspectionClauseColumn = {
  id: string;
  code: string;
  name: string;
  parent?: string;
  inspectionTypeId: string;
  inspectionTypeName?: string;
  isDeleted?: boolean;
  createdBy?: string;
  modifiedBy?: string;
  createdAt: string;
  modifiedAt: string;
};

export function createColumns(
  showAuditColumns: boolean = false,
  editPathPrefix: string = "/inspections/inspection-clause",
): ColumnDef<InspectionClauseColumn>[] {
  const base: ColumnDef<InspectionClauseColumn>[] = [
    {
      accessorKey: "code",
      header: "الكود",
    },
    {
      accessorKey: "name",
      header: "الاسم",
    },
    {
      accessorKey: "inspectionTypeName",
      header: "نوع التفتيش",
    },
    {
      accessorKey: "parent",
      header: "البند الرئيسي",
      cell: ({ row }) => row.original.parent ?? "-",
    },
  ];

  const auditCols: ColumnDef<InspectionClauseColumn>[] = [
    {
      accessorKey: "createdAt",
      header: "تاريخ الإنشاء",
      cell: ({ row }) => formatUtcToCairo(row.original.createdAt),
    },
    {
      accessorKey: "createdBy",
      header: "المنشئ",
    },
    {
      accessorKey: "modifiedAt",
      header: "تاريخ التعديل",
      cell: ({ row }) => formatUtcToCairo(row.original.modifiedAt),
    },
    {
      accessorKey: "modifiedBy",
      header: "المعدل بواسطة",
    },
  ];

  return [
    ...base,
    ...(showAuditColumns ? auditCols : []),
    {
      id: "actions",
      cell: ({ row }) => (
        <CellAction data={row.original} editPathPrefix={editPathPrefix} />
      ),
    },
  ];
}

export const columns = createColumns();
