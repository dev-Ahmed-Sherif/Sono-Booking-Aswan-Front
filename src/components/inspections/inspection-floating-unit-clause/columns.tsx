"use client";

import { ColumnDef } from "@tanstack/react-table";

import CellAction from "@/components/inspections/inspection-floating-unit-clause/cell-action";
import { formatUtcToCairo } from "@/lib/date-timeOptions";

export type InspectionFloatingUnitClauseColumn = {
  id: string;
  isInspected: boolean;
  number?: string;
  note?: string;
  inspectionId: string;
  inspectionClauseId: string;
  inspectionClauseName?: string;
  isDeleted?: boolean;
  createdBy?: string;
  modifiedBy?: string;
  createdAt: string;
  modifiedAt: string;
};

export function createColumns(
  showAuditColumns: boolean = false,
  editPathPrefix: string = "/inspections/inspection-floating-unit-clause",
): ColumnDef<InspectionFloatingUnitClauseColumn>[] {
  const base: ColumnDef<InspectionFloatingUnitClauseColumn>[] = [
    {
      accessorKey: "isInspected",
      header: "تم الفحص",
      cell: ({ row }) => (row.original.isInspected ? "نعم" : "لا"),
    },
    {
      accessorKey: "inspectionClauseName",
      header: "بند التفتيش",
    },
    {
      accessorKey: "number",
      header: "الرقم",
    },
    {
      accessorKey: "note",
      header: "ملاحظات",
    },
  ];

  const auditCols: ColumnDef<InspectionFloatingUnitClauseColumn>[] = [
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
