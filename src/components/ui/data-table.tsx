"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { cn } from "@/lib/utils";

function isRowMarkedDeleted(original: unknown): boolean {
  if (original == null || typeof original !== "object") return false;
  const o = original as Record<string, unknown>;
  return o.isDeleted === true || o.IsDeleted === true;
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
}: DataTableProps<TData, TValue>) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const user = useLocalStorage("user");
  const isSuperAdmin = useMemo(() => {
    const userData = user.getItem() as
      | { role?: string; roleName?: string; roleEn?: string; roleAr?: string }
      | undefined;
    const roleCandidates = [
      userData?.role,
      userData?.roleName,
      userData?.roleEn,
      userData?.roleAr,
    ]
      .filter(Boolean)
      .map((r) => String(r).toLowerCase().trim());
    return roleCandidates.some(
      (r) =>
        r === "super admin" ||
        r === "superadmin" ||
        r.includes("super admin") ||
        r.includes("superadmin"),
    );
  }, [user]);
  const filteredColumns = useMemo(() => {
    if (isSuperAdmin) return columns;
    const hiddenAudit = new Set([
      "createdBy",
      "modifiedBy",
      "createdAt",
      "modifiedAt",
    ]);
    return columns.filter((c) => {
      const accessorKey = (c as { accessorKey?: unknown }).accessorKey;
      return !(typeof accessorKey === "string" && hiddenAudit.has(accessorKey));
    });
  }, [columns, isSuperAdmin]);

  const table = useReactTable({
    data,
    columns: filteredColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      columnFilters,
    },
  });

  return (
    <div className="p-4">
      <div className="flex items-center py-4">
        <Input
          placeholder="بحث"
          value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn(searchKey)?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="text-center">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={cn(
                    isRowMarkedDeleted(row.original) &&
                      "bg-red-100 hover:bg-red-200/90 dark:bg-red-950/40 dark:hover:bg-red-950/55",
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="text-center">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={filteredColumns.length}
                  className="h-24 text-center"
                >
                  لا توجد بيانات.
                  {/* No results. */}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end gap-4 space-x-2 py-4">
        <Button
          variant="outline"
          // size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          السابق
        </Button>
        <Button
          variant="outline"
          // size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          التالى
        </Button>
      </div>
    </div>
  );
}
