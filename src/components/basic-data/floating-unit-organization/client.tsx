"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { DataTable } from "@/components/ui/data-table";
import Heading from "@/components/ui/heading";
import {
  FloatingUnitOrganizationColumn,
  createColumns,
} from "@/components/basic-data/floating-unit-organization/columns";
import { IsDeletedFilterRadios } from "@/components/Shared/is-deleted-filter-radios";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  filterByIsDeleted,
  type IsDeletedFilter,
} from "@/lib/filter-by-is-deleted";
import { isSuperAdminRoleCandidates, RoleCandidates } from "@/lib/role-utils";

type ClientProps = {
  data: FloatingUnitOrganizationColumn[] | null;
  onEditClick?: (row: FloatingUnitOrganizationColumn) => void;
  onDeleteSuccess?: (id: string) => void;
  /** When set, only rows for this floating unit are shown */
  floatingUnitId?: string;
};

const Client = memo(
  ({
    data,
    onEditClick,
    onDeleteSuccess,
    floatingUnitId,
  }: ClientProps) => {
    const user = useLocalStorage("user");
    const isSuperAdmin = isSuperAdminRoleCandidates(
      user.getItem() as RoleCandidates,
    );
    const [deletedFilter, setDeletedFilter] =
      useState<IsDeletedFilter>("active");
    const [tableData, setTableData] = useState<FloatingUnitOrganizationColumn[]>(
      data ?? [],
    );

    useEffect(() => {
      setTableData(data ?? []);
    }, [data]);

    const scopedRows = useMemo(() => {
      if (!floatingUnitId) return tableData;
      return tableData.filter((r) => (r.floatingUnitId ?? "") === floatingUnitId);
    }, [tableData, floatingUnitId]);

    const displayRows = useMemo(() => {
      return isSuperAdmin
        ? filterByIsDeleted(scopedRows, deletedFilter)
        : scopedRows;
    }, [isSuperAdmin, scopedRows, deletedFilter]);

    const columns = useMemo(
      () =>
        createColumns(onEditClick, (id) => {
          setTableData((prev) => prev.filter((r) => r.id !== id));
          onDeleteSuccess?.(id);
        }),
      [onDeleteSuccess, onEditClick],
    );

    return (
      <div className="mt-7 sm:mt-0 space-y-4">
        <div className="p-2 sm:p-4 flex flex-col sm:flex-row items-center sm:justify-between gap-3 sm:gap-4">
          <div className="w-full sm:w-auto text-center sm:text-right">
            <Heading
              title={`عدد البيانات (${displayRows.length})`}
              description="ربط الجهات بالوحدات العائمة"
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
          <DataTable
            searchKey="organizationNameAr"
            columns={columns}
            data={displayRows}
          />
        </div>
      </div>
    );
  },
);
Client.displayName = "Client";
export default Client;
