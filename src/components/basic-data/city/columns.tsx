"use client";

import { ColumnDef } from "@tanstack/react-table";

import CellAction from "@/components/basic-data/city/cell-action";

import type { CityListRow } from "@/lib/governorate-cities";

export type CityColumn = CityListRow;

export function createColumns(
  onEditClick?: (row: CityColumn) => void,
  onDeleteSuccess?: (id: string) => void,
): ColumnDef<CityColumn>[] {
  return [
    {
      accessorKey: "code",
      header: "الكود",
    },
    {
      accessorKey: "nameAr",
      header: "الاسم العربي",
    },
    {
      accessorKey: "nameEn",
      header: "الاسم الإنجليزي",
      cell: ({ row }) => row.original.nameEn ?? "—",
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
