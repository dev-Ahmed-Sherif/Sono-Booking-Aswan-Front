"use client";

import { ColumnDef } from "@tanstack/react-table";
import CellAction from "@/components/basic-data/floating-unit-organization/cell-action";

export type FloatingUnitOrganizationColumn = {
  id: string;
  organizationId?: string;
  organizationNameAr: string;
  /** From API `OrganizationType` (e.g. OwnerCompany = 1, OperatingCompany = 2). */
  organizationTypeId?: number;
  organizationTypeCode?: string;
  isDeleted?: boolean;
};

export function createColumns(
  onEditClick?: (row: FloatingUnitOrganizationColumn) => void,
  onDeleteSuccess?: (id: string) => void,
): ColumnDef<FloatingUnitOrganizationColumn>[] {
  return [
    {
      accessorKey: "organizationNameAr",
      header: "الجهة",
      cell: ({ row }) => row.original.organizationNameAr || "-",
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
