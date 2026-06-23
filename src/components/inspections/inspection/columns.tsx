"use client";

import { ColumnDef } from "@tanstack/react-table";

import CellAction from "@/components/inspections/inspection/cell-action";
import { formatUtcToCairo, formatUtcToCairoDate } from "@/lib/date-timeOptions";

export type InspectionColumn = {
  id: string;
  inspectionDate: string;
  floatingUnitId: string;
  floatingUnit?: string;
  organizationId: string;
  organization?: string;
  saftyPetroleumWaste: boolean;
  rightWasteDisposal: boolean;
  isDeleted?: boolean;
  createdBy?: string;
  modifiedBy?: string;
  createdAt: string;
  modifiedAt: string;
};

export function createColumns(
  showAuditColumns: boolean = false,
  editPathPrefix: string = "/inspections/inspection",
  showEnvironmentalColumns: boolean = false,
): ColumnDef<InspectionColumn>[] {
  const base: ColumnDef<InspectionColumn>[] = [
    {
      accessorKey: "inspectionDate",
      header: "تاريخ التفتيش",
      cell: ({ row }) => formatUtcToCairoDate(row.original.inspectionDate),
    },
    {
      accessorKey: "floatingUnit",
      header: "الوحدة العائمة",
    },
    {
      accessorKey: "organization",
      header: "جهة التفتيش",
    },
  ];

  const environmentalCols: ColumnDef<InspectionColumn>[] = [
    {
      accessorKey: "saftyPetroleumWaste",
      header: "سلامة النفايات البترولية",
      cell: ({ row }) => (row.original.saftyPetroleumWaste ? "نعم" : "لا"),
    },
    {
      accessorKey: "rightWasteDisposal",
      header: "التخلص السليم من النفايات",
      cell: ({ row }) => (row.original.rightWasteDisposal ? "نعم" : "لا"),
    },
  ];

  const auditCols: ColumnDef<InspectionColumn>[] = [
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
    ...(showEnvironmentalColumns ? environmentalCols : []),
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
