"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { DataTable } from "@/components/ui/data-table";
import Heading from "@/components/ui/heading";
import {
  FloatingUnitStaffColumn,
  createColumns,
  type FloatingUnitStaffColumnsLookups,
} from "@/components/basic-data/floating-unit-staff/columns";
import { IsDeletedFilterRadios } from "@/components/Shared/is-deleted-filter-radios";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  filterByIsDeleted,
  type IsDeletedFilter,
} from "@/lib/filter-by-is-deleted";
import { isSuperAdminRoleCandidates, RoleCandidates } from "@/lib/role-utils";

type ClientProps = {
  data: FloatingUnitStaffColumn[] | null;
  onEditClick?: (row: FloatingUnitStaffColumn) => void;
  onDeleteSuccess?: (id: string) => void;
  showAuditColumns?: boolean;
  lookups?: FloatingUnitStaffColumnsLookups;
};

const Client = memo(
  ({
    data,
    onEditClick,
    onDeleteSuccess,
    showAuditColumns = false,
    lookups,
  }: ClientProps) => {
    const user = useLocalStorage("user");
    const isSuperAdmin = useMemo(
      () => isSuperAdminRoleCandidates(user.getItem() as RoleCandidates),
      [user],
    );
    const [deletedFilter, setDeletedFilter] =
      useState<IsDeletedFilter>("active");
    const [tableData, setTableData] = useState<FloatingUnitStaffColumn[]>(
      data ?? [],
    );

    useEffect(() => {
      setTableData(data ?? []);
    }, [data]);

    const displayRows = useMemo(() => {
      return isSuperAdmin
        ? filterByIsDeleted(tableData, deletedFilter)
        : tableData;
    }, [isSuperAdmin, tableData, deletedFilter]);

    const columns = useMemo(
      () =>
        createColumns(
          onEditClick,
          (id) => {
            setTableData((prev) => prev.filter((r) => r.id !== id));
            onDeleteSuccess?.(id);
          },
          showAuditColumns,
          lookups,
        ),
      [onDeleteSuccess, onEditClick, showAuditColumns, lookups],
    );

    return (
      <div className="mt-7 sm:mt-0 space-y-4">
        <div className="p-2 sm:p-4 flex flex-col sm:flex-row items-center sm:justify-between gap-3 sm:gap-4">
          <div className="w-full sm:w-auto text-center sm:text-right">
            <Heading
              title={`عدد البيانات (${displayRows.length})`}
              description="طاقم الوحدة العائمة"
            />
          </div>
        </div>
        <Separator className="my-2" />
        <div className="overflow-x-auto rounded-md">
          {isSuperAdmin ? (
            <IsDeletedFilterRadios
              value={deletedFilter}
              onChange={setDeletedFilter}
              className="mb-3 px-1"
            />
          ) : null}
          <DataTable searchKey="name" columns={columns} data={displayRows} />
        </div>
      </div>
    );
  },
);
Client.displayName = "FloatingUnitStaffClient";
export default Client;
