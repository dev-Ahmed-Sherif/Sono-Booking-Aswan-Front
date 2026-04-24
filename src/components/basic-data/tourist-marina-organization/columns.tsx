"use client";

import { ColumnDef } from "@tanstack/react-table";
import CellAction from "@/components/basic-data/tourist-marina-organization/cell-action";

export type TouristMarinaOrganizationColumn = {
  id: string;
  licenseNumber: string;
  organizationId?: string;
  organizationNameAr: string;
  fromDate?: string;
  toDate?: string;
  isActive?: boolean;
};

export function createColumns(
  onEditClick?: (row: TouristMarinaOrganizationColumn) => void,
  onDeleteSuccess?: (id: string) => void,
): ColumnDef<TouristMarinaOrganizationColumn>[] {
  return [
    { accessorKey: "licenseNumber", header: "رقم الترخيص" },
    {
      accessorKey: "organizationNameAr",
      header: "الجهة",
      cell: ({ row }) => row.original.organizationNameAr || "-",
    },
    {
      accessorKey: "fromDate",
      header: "من تاريخ",
      cell: ({ row }) => row.original.fromDate || "-",
    },
    {
      accessorKey: "toDate",
      header: "إلى تاريخ",
      cell: ({ row }) => row.original.toDate || "-",
    },
    {
      accessorKey: "isActive",
      header: "الحالة",
      cell: ({ row }) => (row.original.isActive ? "نشط" : "غير نشط"),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <CellAction
          data={row.original}
          onEditClick={onEditClick}
          onDeleteSuccess={onDeleteSuccess}
        />
      ),
    },
  ];
}

export const columns = createColumns();
